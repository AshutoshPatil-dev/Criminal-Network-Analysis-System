import type { FirDocument } from '../types';

export interface OcrResult {
  fields: Record<string, string>;
  confidence: Record<string, number>;
  provider: 'tesseract' | 'mock';
  text: string;
}

const pickSample = (seed: number) => {
  return seed % 2 === 0 ? SAMPLE_FIR_A : SAMPLE_FIR_B;
};

// Bundled reference FIRs used by the offline demo OCR. In a real deployment the
// recognizer runs server-side (or Tesseract.js in the browser) against the
// uploaded photo; here we deterministically return a realistic FIR text so the
// extract-and-verify flow can be demonstrated without a network.
const SAMPLE_FIR_A = (`
FIRST INFORMATION REPORT
Police Station: Shri Anandpur PS, District: Patna, State: Bihar
FIR No.: 2026/0417
Date & Time of Incident: 22/03/2026 21:45
Sections/Acts: 395 IPC (392 BNS), 397 IPC (312 BNS)
Complainant: Suresh Ram, Age 52, S/o Late Bhola Ram
Address: 14-K, Boring Road, Patna, Bihar
Phone: +91-9835012340
Accused/Subject: Rajesh Kumar Singh (alias R.K. Singh), Mohammed Irfan (alias Irfan Miyan)
Incident Location: Armoured van hold-up near Sector 18, Patna
Description: The complainant and the driver were intercepted by four masked persons near the State Road Transport parking lot. The accused fired one round in the air, threatened the crew and fled with the cash box containing Rs. 48,00,000 and two service pistols.
Property stolen: Cash Rs. 48,00,000, 2 service pistols
Action Taken: Site inspection completed, two abandoned vehicles seized near the bye-pass; CCTV collection under process.
IO In-charge: Inspector R. Sharma, Patna Urban Sub-Division
`).trim();

const SAMPLE_FIR_B = (`
FIRST INFORMATION REPORT
Police Station: Garden Reach PS, District: Kolkata, State: Western Bengal
FIR No.: 2026/0501
Date & Time of Incident: 05/04/2026 02:10
Sections/Acts: 460 IPC (311 BNS), 488 IPC (303 BNS)
Complainant: Abdul Qureshi, Age 45, S/o Mahfooz Qureshi
Address: 23B, Kidderpore Dock Road, Kolkata
Phone: +91-9933122088
Accused/Subject: Sameer Khan (alias Sam), Ajay Kumar (alias Ajju)
Incident Location: Container yard, Kolkata Port Trust
Description: Offenders gained entry into the bonded container yard overnight, cut the seal of container number MSKU-884217 and removed 42 cartons of imported fabric. Two guards were locked in a store room during the act.
Property stolen: 42 cartons of imported fabric (approx. value Rs. 12,50,000)
Action Taken: Customs notified, port CCTV segment for 02:00-02:30 hrs under examination.
IO In-charge: Sub-Inspector T. Bose, Port Enforcement Cell
`).trim();

const fieldLabels: Array<[keyof FirDocument, string]> = [
  ['policeStation', 'police station'],
  ['district', 'district'],
  ['state', 'state'],
  ['firNumber', 'fir no'],
  ['incidentDate', 'date & time of incident'],
  ['incidentTime', 'date & time of incident'],
  ['sectionsLaw', 'sections'],
  ['complainantName', 'complainant'],
  ['complainantAddress', 'address'],
  ['complainantPhone', 'phone'],
  ['subjectName', 'accused'],
  ['subjectAliases', 'alias'],
  ['incidentLocation', 'incident location'],
  ['incidentDescription', 'description'],
  ['evidenceSummary', 'stolen'],
  ['ioName', 'io in-charge'],
];

export function extractFirFields(text: string, provider: 'tesseract' | 'mock' = 'mock'): OcrResult {
  const fields: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const lines = text.split('\n');

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

  setIf('firNumber', tryRegex(/(?:FIR\s*No\.?\s*[:-]?\s*)([0-9/]+)/i), 0.97);
  setIf('policeStation', tryRegex(/(?:Police\s*Station\s*[:-]?\s*)([^\n,]+)/i), 0.92);
  setIf('sectionsLaw', tryRegex(/(?:Sections\s*\/\s*Acts\s*[:-]?\s*)([^\n]+)/i), 0.85);

  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const [key, label] of fieldLabels) {
      if (fields[key]) continue;
      if (lower.includes(label)) {
        const value = line.split(':').slice(1).join(':').trim();
        if (value) {
          fields[key] = value;
          confidence[key] = key === 'firNumber' ? 0.97 : 0.8;
          if (key === 'sectionsLaw' && !fields.sectionsLaw) {
            fields.sectionsLaw = value;
            confidence.sectionsLaw = 0.85;
          }
        }
      }
    }
  }

  // Multi-line: description runs until the next labelled line
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
      if (/^(Property stolen|Action Taken|IO In-charge)/i.test(l)) break;
      descLines.push(l);
    }
    if (descLines.length > 0) {
      fields.incidentDescription = descLines.join(' ').trim();
      confidence.incidentDescription = 0.62;
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
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(w.Tesseract);
    s.onerror = () => reject(new Error('OCR engine unavailable'));
    document.head.appendChild(s);
  });

const hashName = (name: string) => Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);

export const extractFirFromImage = async (file: File): Promise<OcrResult> => {
  const hash = hashName(file.name);
  const fallback = () => {
    const sample = pickSample(hash);
    return extractFirFields(sample, 'mock');
  };
  try {
    const engine = await loadTesseract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyEngine = engine as any;
    const worker = await anyEngine.createWorker('eng');
    const { data } = await worker.recognize(file);
    await worker.terminate();
    const text: string = data?.text || '';
    if (!text || text.trim().length < 20) return fallback();
    return extractFirFields(text, 'tesseract');
  } catch {
    return fallback();
  }
};