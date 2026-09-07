import type { FirDocument } from '../types';

export interface OcrResult {
  fields: Record<string, string>;
  confidence: Record<string, number>;
  provider: string;
  text: string;
}

export interface OcrOptions {
  /**
   * Handwriting compensation: the image is up-scaled 2x, converted to
   * grayscale with contrast stretching and light sharpening before OCR.
   * Plain printed scans should leave this off.
   */
  handwriting?: boolean;
  /**
   * Tesseract language code. 'eng' is bundled with the engine; 'hin'
   * downloads the Devanagari model on first use (needs network).
   */
  lang?: 'eng' | 'hin';
}

export interface ExtractorOptions {
  /** Use fuzzy (edit-distance) label matching so noisy/handwritten OCR still resolves fields. */
  fuzzy?: boolean;
}

type FieldLabel = [keyof FirDocument, string, string[]];

const fieldLabels: FieldLabel[] = [
  ['policeStation', 'police station', ['police', 'station']],
  ['district', 'district', ['district']],
  ['state', 'state', ['state']],
  ['firNumber', 'fir no', ['fir', 'no']],
  ['incidentDate', 'date & time of incident', ['date', 'incident']],
  ['sectionsLaw', 'sections/acts', ['sections', 'acts']],
  ['complainantName', 'complainant', ['complainant']],
  ['complainantAddress', 'address', ['address']],
  ['complainantPhone', 'phone', ['phone']],
  ['subjectName', 'accused/subject', ['accused', 'subject']],
  ['subjectAliases', 'alias', ['alias']],
  ['incidentLocation', 'incident location', ['incident', 'location']],
  ['incidentDescription', 'description', ['description']],
  ['evidenceSummary', 'property stolen', ['property', 'stolen']],
  ['ioName', 'io in-charge', ['io', 'in-charge']],
];

const editDist = (a: string, b: string): number => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
};

const tokensOf = (line: string) => line.toLowerCase().split(/[\s,.:;&/#(())'"%+-]+/).filter(Boolean);

/** Fuzzy token equality — a token counts as the label word if it is within ~1/4 characters. */
const near = (t: string, w: string): boolean => {
  if (t === w) return true;
  if (t.length < 3 || w.length < 3) return false;
  return editDist(t, w) <= Math.max(1, Math.round(w.length / 4));
};

const matchScore = (line: string, words: string[]): { score: number; hits: number } => {
  const toks = tokensOf(line);
  let hits = 0;
  for (const w of words) {
    if (toks.some(t => near(t, w))) hits++;
  }
  return { score: words.length ? hits / words.length : 0, hits };
};

/**
 * Removes the (fuzzy-matched) label tokens and cuts the value short at the
 * next known label so a single messy line like
 * "POLLCE STaHon SHRI ANANDPUR DISTRICT PATNA" still yields "shri anandpur".
 */
const stripLabels = (line: string, words: string[], otherWords: string[]): string => {
  const toks = tokensOf(line);
  const kept: string[] = [];
  let removed = 0;
  for (const raw of toks) {
    const t = raw.toLowerCase();
    if (removed > 0 && otherWords.some(w => near(t, w))) break;
    const i = words.findIndex(w => near(t, w));
    if (i >= 0 && removed < words.length) {
      removed++;
      continue;
    }
    kept.push(raw);
  }
  if (removed === 0) return '';
  return kept.join(' ').replace(/^[\s,.:;/#()'"%-]+/, '').trim();
};

export function extractFirFields(
  text: string,
  provider = 'tesseract',
  opts: ExtractorOptions = {},
): OcrResult {
  const fields: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const { fuzzy = true } = opts;

  const tryRegex = (pattern: RegExp): string | undefined => {
    const m = text.match(pattern);
    return m ? m[1].trim() : undefined;
  };

  const setIf = (key: string, value: string | undefined, conf: number) => {
    if (value) {
      fields[key] = value;
      confidence[key] = conf;
    }
  };

  // Fast path: clean printed OCR with standard labels.
  setIf('firNumber', tryRegex(/(?:F\s*I\s*R\s*No\.?\s*[:-]?\s*)([0-9/]+)/i), 0.97);
  setIf('policeStation', tryRegex(/(?:Police\s*Station\s*[:-]?\s*)([^\n,]+)/i), 0.92);
  setIf('sectionsLaw', tryRegex(/(?:Sections?\s*\/?\s*Acts?\s*[:-]?\s*)([^\n]+)/i), 0.85);

  // Composite "Police Station: X, District: Y, State: Z" line → pull district/state.
  const stationLine = lines.find(l => /police station/i.test(l));
  if (stationLine) {
    const dm = stationLine.match(/district\s*:?\s*([^,;]+?)(?:\s*[,;]\s*state\s*:?\s*([^,;]+))?$/i);
    if (dm) {
      if (!fields.district && dm[1]) { fields.district = dm[1].trim(); confidence.district = 0.9; }
      if (!fields.state && dm[2]) { fields.state = dm[2].trim(); confidence.state = 0.9; }
    }
  }

  for (const line of lines) {
    const lower = line.toLowerCase();
    const head = lower.split(':')[0]; // text before the first colon — the record header
    for (const [key, label] of fieldLabels) {
      if (fields[key]) continue;
      if (key === 'firNumber' || key === 'policeStation' || key === 'sectionsLaw') continue; // regexes above
      if (!head.includes(label)) continue; // only accept records that start with their label
      const value = line.split(':').slice(1).join(':').trim();
      if (value) {
        fields[key] = value;
        confidence[key] = key === 'incidentDate' ? 0.9 : 0.8;
      }
    }
  }

  // Rescued path: fuzzy label matching for noisy / handwritten OCR.
  if (fuzzy) {
    for (const [key, , words] of fieldLabels) {
      if (fields[key]) continue;
      let best: { line: string; score: number; hits: number } | null = null;
      for (const line of lines) {
        const { score, hits } = matchScore(line, words);
        if (hits >= 1 && (!best || score > best.score)) best = { line, score, hits };
      }
      if (!best || best.score < 0.55) continue;
      const otherWords = fieldLabels.flatMap(([k, , w]) => (k === key ? [] : w));
      let value = stripLabels(best.line, words, otherWords);
      if (!value && words.length === 2) value = stripLabels(best.line, [...words].reverse(), otherWords);
      if (key === 'firNumber') {
        const num = value.match(/[0-9][0-9/.\- ]{2,}[0-9]/);
        if (num) value = num[0].replace(/[:,.;]+$/, '').trim();
      }
      if (value) {
        const conf = Math.min(0.85, 0.5 + 0.3 * best.score);
        fields[key] = value;
        confidence[key] = conf;
      }
    }
  }

  // Multi-line description: runs until the next labelled line
  const descIdx = lines.findIndex(l => l.toLowerCase().includes('description') || l.toLowerCase().includes('date & time'));
  if (descIdx >= 0 && !fields.incidentDescription) {
    const descLines: string[] = [];
    let started = false;
    for (let i = descIdx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (!started) {
        if (l.trim().length === 0) continue;
        started = true;
      }
      if (/^(Property stolen|Action Taken|IO In-charge|IO)/i.test(l)) break;
      descLines.push(l);
    }
    if (descLines.length > 0) {
      fields.incidentDescription = descLines.join(' ').trim();
      confidence.incidentDescription = fuzzy ? 0.5 : 0.62;
    }
  }

  // Date & time split
  if (fields.incidentDate && !fields.incidentTime) {
    const m = fields.incidentDate.match(/([\d/]+\s*[\d/]+)\s+([\d:APM]+)/i);
    if (!m) {
      const d = fields.incidentDate.match(/[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}/);
      if (d) fields.incidentDate = d[0];
    } else {
      fields.incidentDate = m[1].trim();
      fields.incidentTime = m[2].trim();
    }
    if (fields.incidentDate) confidence.incidentDate = 0.9;
  }

  return { fields, confidence, provider, text };
}

const loadTesseract = (): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const w = window as unknown as { Tesseract?: unknown };
    if (w.Tesseract) return resolve(w.Tesseract);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.integrity = 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(w.Tesseract);
    s.onerror = () => reject(new Error('OCR engine unavailable'));
    document.head.appendChild(s);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image load failed'));
    i.src = src;
  });

/**
 * Camera/thin handwriting is often low contrast and under-resolved. Upscale 2x,
 * grayscale, stretch contrast, then unsharp-mask lightly — Tesseract then has a
 * much easier signal to work on.
 */
export const preprocessHandwrittenImage = async (file: File): Promise<string> => {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = Math.round(img.naturalWidth * 2);
    const h = Math.round(img.naturalHeight * 2);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const px = image.data;

    // Luminance range for contrast stretching
    let min = 255, max = 0;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
    }
    const span = Math.max(8, max - min);

    // Neighbour lookup box for a light sharpen
    const sharp = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const stretched = Math.round(((lum - min) / span) * 255);
        sharp[i] = sharp[i + 1] = sharp[i + 2] = stretched;
        sharp[i + 3] = 255;
      }
    }
    // Unsharp mask: edge = gray - blurred(3x3), out = gray + 0.6*edge
    const out = new Uint8ClampedArray(sharp.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let avg = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            avg += sharp[(ny * w + nx) * 4];
            count++;
          }
        }
        const blurred = avg / count;
        const sharpened = sharp[i] + 0.6 * (sharp[i] - blurred);
        out[i] = out[i + 1] = out[i + 2] = Math.max(0, Math.min(255, sharpened));
        out[i + 3] = 255;
      }
    }
    image.data.set(out);
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
};

const emptyResult = (): OcrResult => ({ fields: {}, confidence: {}, provider: 'tesseract', text: '' });

export const extractFirFromImage = async (file: File, opts: OcrOptions = {}): Promise<OcrResult> => {
  const { handwriting = false, lang = 'eng' } = opts;
  try {
    const engine = await loadTesseract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyEngine = engine as any;
    const worker = await anyEngine.createWorker(lang);
    const source: File | string = handwriting ? await preprocessHandwrittenImage(file) : file;
    const { data } = await worker.recognize(source);
    await worker.terminate();
    const text: string = String(data?.text || '');
    if (!text || text.trim().length < 20) return emptyResult();
    return extractFirFields(text, 'tesseract', { fuzzy: true });
  } catch {
    return emptyResult();
  }
};