import { useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import type { FirAttachment, FirDocument } from '../types';
import { extractFirFromImage } from '../lib/firExtractor';
import { uploadCdrFile } from '../lib/supabase';

const emptyTemplate = (o: { name: string; rank: string; district: string; state: string; badgeNumber: string }): Omit<FirDocument, 'id' | 'createdAt' | 'createdBy'> => ({
  ref: '',
  firNumber: '',
  policeStation: '',
  district: o.district || '',
  state: o.state || '',
  incidentDate: '',
  incidentTime: '',
  sectionsLaw: '',
  complainantName: '',
  complainantAge: '',
  complainantFather: '',
  complainantAddress: '',
  complainantPhone: '',
  subjectName: '',
  subjectAliases: '',
  accusedDetails: '',
  incidentLocation: '',
  incidentDescription: '',
  evidenceSummary: '',
  ioName: o.name || '',
  ioRank: o.rank || '',
  attachments: [],
  ocrSource: undefined,
  reportRef: undefined,
});

const fileChecksum = (name: string, size: number) => {
  const seed = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), size % 97);
  return `CHK-${seed.toString(16).padStart(4, '0')}-${(size * 31 % 4096).toString(16)}`;
};

const fmtSize = (n: number) => n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

type FieldKey = keyof Omit<FirDocument, 'id' | 'ref' | 'createdAt' | 'createdBy' | 'attachments' | 'ocrSource' | 'reportRef'>;

const OCR_HINT: Record<string, string> = {
  real: 'tesseract.js (browser) — reads text from the uploaded photo',
  mock: 'Demo OCR — bundled sample FIR used offline; verify every field before filing',
};

function FirField({ label, value, on, autoFilled, wide }: {
  label: string;
  value: string;
  on: (v: string) => void;
  autoFilled?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-nexus-text-secondary">
        {label}{autoFilled && <span className="ml-1 text-nexus-accent" title="Auto-filled by OCR — verify">⟵ OCR</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => on(e.target.value)}
        className="w-full border-b border-nexus-border bg-transparent py-1 text-sm font-medium focus:outline-none focus:border-nexus-blue focus:border-b-2"
        title={autoFilled ? 'Auto-filled by OCR — verify' : undefined}
      />
    </div>
  );
}

export default function FirReport() {
  const { t, currentUser, user, officers, submittedReports, firDocuments, saveFirDocument, addAuditLog } = useApp();
  const profile = user ?? { id: '', name: currentUser, rank: 'Officer', district: '—', state: '—', badgeNumber: '—', email: '', phone: '—', role: 'case-officer' as const, createdAt: '' };
  const [doc, setDoc] = useState<Omit<FirDocument, 'id' | 'createdAt' | 'createdBy'>>(() => emptyTemplate(profile));
  const [ocrInfo, setOcrInfo] = useState<{ provider: string; confidence: Record<string, number>; source: string } | null>(null);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attachmentKind, setAttachmentKind] = useState<FirAttachment['kind']>('call_records');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const savedCount = firDocuments.length;
  const docRef = doc.ref || `FIR-2026-${String(savedCount + 1).padStart(4, '0')}`;

  const set = (key: FieldKey) => (v: string) => setDoc(prev => ({ ...prev, [key]: v }));

  const loadLatestReport = () => {
    const r = submittedReports[0];
    if (!r) { setNotice('No submitted report available yet — file one under New Report.'); return; }
    const target = officers.find(o => o.name === r.submittedBy) || profile;
    setDoc({
      ...emptyTemplate(target),
      firNumber: r.firNumber && r.firNumber !== '—' ? r.firNumber : '',
      subjectName: r.subjectName,
      incidentLocation: r.incidentLocation || '',
      incidentDescription: `Subject: ${r.subjectName}. Evidence details recorded under the case file (${r.detailCount} entries). Verify against the FIR Register before filing.`,
      reportRef: r.id,
      ioName: target.name,
      ioRank: target.rank,
      district: target.district,
      state: target.state,
    });
    setOcrImage(null);
    setOcrInfo(null);
    setNotice(`Populated from ${r.id} (submitted by ${r.submittedBy}).`);
  };

  const runOcr = async (file: File) => {
    setOcrBusy(true);
    setNotice(null);
    try {
      const res = await extractFirFromImage(file);
      setDoc(prev => {
        const merged: typeof prev = { ...prev, ocrSource: file.name };
        (Object.keys(res.fields) as FieldKey[]).forEach(k => {
          const v = res.fields[k];
          if (typeof v === 'string') (merged as unknown as Record<string, string>)[k] = v;
        });
        return merged;
      });
      setOcrInfo({ provider: res.provider, confidence: res.confidence, source: file.name });
      setOcrImage(URL.createObjectURL(file));
      addAuditLog({ action: 'ocr_fir', level: 'info', summary: `OCR intake on ${file.name} (${res.provider === 'tesseract' ? 'tesseract.js' : 'demo'}); ${Object.keys(res.confidence).length} fields extracted.`, target: docRef });
      setNotice(`OCR extracted ${Object.keys(res.confidence).length} fields — please verify before filing.`);
    } finally {
      setOcrBusy(false);
    }
  };

  const onAddAttachment = async (file: File) => {
    const att: FirAttachment = {
      id: `att-${Date.now()}`,
      kind: attachmentKind,
      name: file.name,
      size: fmtSize(file.size),
      checksum: fileChecksum(file.name, file.size),
      createdAt: new Date().toISOString(),
      note: attachmentKind === 'call_records' ? 'Call Data Record' : attachmentKind === 'transaction_history' ? 'Bank / transaction records' : 'Other evidence',
    };
    try {
      const res = await uploadCdrFile('case-files', file);
      if (res) att.storagePath = res.storagePath;
    } catch { /* offline */ }
    setDoc(prev => ({ ...prev, attachments: [...prev.attachments, att] }));
    addAuditLog({ action: 'upload_attachment', level: 'info', summary: `Attached ${att.name} (${att.size}) to ${docRef}.`, target: `${att.checksum}${att.storagePath ? ' · ' + att.storagePath : ''}` });
  };

  const save = () => {
    saveFirDocument({ ...doc, ref: docRef });
    setNotice(`FIR document ${docRef} saved${ocrInfo ? ' (OCR: ' + ocrInfo.provider + ')' : ''}.`);
  };

  const exportWord = () => {
    const html = firHtml({ ...doc, ref: docRef });
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docRef || 'FIR'}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    addAuditLog({ action: 'export', level: 'info', summary: `Exported FIR ${docRef} as Word document.`, target: docRef });
  };

  const fieldConf = (k: string): number | null => ocrInfo?.confidence[k] ?? null;

  const attachmentRows = useMemo(() => doc.attachments, [doc.attachments]);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6 no-print-zone">
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">{t('firTitle')}</h1>
          <p className="text-sm text-nexus-text-secondary mt-1">{t('firSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadLatestReport} className="px-3 py-2 rounded-lg border border-nexus-border text-sm font-medium hover:bg-nexus-surface transition">
            {t('fromSubmittedReport')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrBusy}
            className="px-3 py-2 rounded-lg bg-nexus-accent text-nexus-blue text-sm font-bold hover:brightness-95 disabled:opacity-50 transition"
          >
            {ocrBusy ? 'OCR…' : t('uploadFirImage')}
          </button>
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-nexus-blue text-white text-sm font-semibold hover:bg-nexus-blue-light transition">
            {t('printPdf')}
          </button>
          <button onClick={exportWord} className="px-3 py-2 rounded-lg border border-nexus-blue text-nexus-blue text-sm font-semibold hover:bg-nexus-blue/5 transition">
            {t('exportWord')}
          </button>
          <button onClick={save} className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition">
            {t('saveDocument')}
          </button>
        </div>
      </div>

      {notice && <div className="no-print bg-green-50 border border-green-300 rounded-xl px-4 py-3 text-sm text-green-800" role="status">{notice}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4 no-print">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { void runOcr(f); e.target.value = ''; }
            }}
          />
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
            <h2 className="font-semibold text-sm mb-2">{t('firOcrPanel')}</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrBusy}
              className="w-full border-2 border-dashed border-nexus-border rounded-lg py-6 text-center text-sm text-nexus-text-secondary hover:bg-nexus-surface transition"
            >
              {ocrBusy ? 'Reading image…' : '📷  ' + t('ocrDropHint')}
            </button>
            {ocrImage && <img src={ocrImage} alt="Uploaded FIR" className="mt-3 rounded-lg border border-nexus-border max-h-40 object-contain" />}
            {ocrInfo && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-nexus-text">
                  OCR: {ocrInfo.provider === 'tesseract' ? 'tesseract.js' : 'demo'} · {Object.keys(ocrInfo.confidence).length} fields
                </p>
                <p className="text-[11px] text-nexus-text-secondary mt-1">{OCR_HINT[ocrInfo.provider]}</p>
                <details className="mt-2">
                  <summary className="text-[11px] text-nexus-blue cursor-pointer">Confidence per field</summary>
                  <ul className="mt-1 space-y-0.5 text-[11px]">
                    {Object.entries(ocrInfo.confidence).map(([k, c]) => (
                      <li key={k} className="flex justify-between"><span className="text-nexus-text-secondary">{k}</span><span className="font-mono">{Math.round(c * 100)}%</span></li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
            <h2 className="font-semibold text-sm mb-2">{t('evidenceAttachments')}</h2>
            <div className="flex gap-2 mb-2">
              {(['call_records', 'transaction_history', 'other'] as const).map(k => (
                <button key={k} onClick={() => setAttachmentKind(k)} className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${attachmentKind === k ? 'bg-nexus-blue text-white border-nexus-blue' : 'border-nexus-border text-nexus-text-secondary'}`}>
                  {k === 'call_records' ? 'CDR' : k === 'transaction_history' ? 'TXN' : 'Other'}
                </button>
              ))}
            </div>
            <label className="block border-2 border-dashed border-nexus-border rounded-lg py-4 text-center text-xs text-nexus-text-secondary cursor-pointer hover:bg-nexus-surface transition">
              ⬆ {t('uploadEvidenceFile')}
              <input type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { void onAddAttachment(f); e.target.value = ''; }
              }} />
            </label>
            {attachmentRows.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {attachmentRows.map(a => (
                  <li key={a.id} className="text-[11px] bg-nexus-surface rounded-lg px-2 py-1.5">
                    <p className="font-medium text-nexus-text truncate">{a.name} <span className="text-nexus-text-secondary">({a.size})</span></p>
                    <p className="font-mono text-nexus-text-secondary">{a.checksum}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-8" id="fir-print-area" ref={printAreaRef}>
            <div className="text-center border-b-2 border-nexus-blue pb-3">
              <p className="text-[10px] font-bold tracking-[0.25em] text-nexus-text-secondary uppercase">{t('govtPoliceHeader')}</p>
              <h2 className="text-2xl font-black text-nexus-text tracking-wide">FIRST INFORMATION REPORT</h2>
              <p className="text-xs text-nexus-text-secondary mt-1">
                {t('policeStation')}: <span className="font-semibold text-nexus-text">{doc.policeStation || '____________'}</span> &nbsp;·&nbsp; {t('district')}: <span className="font-semibold text-nexus-text">{doc.district || '____________'}</span>, {doc.state}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-5">
              <FirField label={t('firNo')} value={doc.firNumber} on={set('firNumber')} />
              <FirField label={t('incidentDate')} value={doc.incidentDate} on={set('incidentDate')} autoFilled={fieldConf('incidentDate') !== null} />
              <FirField label={t('incidentTime')} value={doc.incidentTime} on={set('incidentTime')} />
              <FirField label={t('sectionsLaw')} value={doc.sectionsLaw} on={set('sectionsLaw')} autoFilled={fieldConf('sectionsLaw') !== null} wide />
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-blue border-b border-nexus-border pb-1">1 · {t('complainant')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-3">
                <FirField label={t('complainantName')} value={doc.complainantName} on={set('complainantName')} autoFilled={fieldConf('complainantName') !== null} wide />
                <FirField label={t('complainantAge')} value={doc.complainantAge} on={set('complainantAge')} />
                <FirField label={t('fathersName')} value={doc.complainantFather} on={set('complainantFather')} />
                <FirField label={t('complainantPhone')} value={doc.complainantPhone} on={set('complainantPhone')} autoFilled={fieldConf('complainantPhone') !== null} />
                <FirField label={t('complainantAddress')} value={doc.complainantAddress} on={set('complainantAddress')} autoFilled={fieldConf('complainantAddress') !== null} wide />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-blue border-b border-nexus-border pb-1">2 · {t('accusedSection')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 mt-3">
                <FirField label={t('subjectAccused')} value={doc.subjectName} on={set('subjectName')} autoFilled={fieldConf('subjectName') !== null} wide />
                <FirField label={t('aliasesShort')} value={doc.subjectAliases} on={set('subjectAliases')} />
                <FirField label={t('otherAccused')} value={doc.accusedDetails} on={set('accusedDetails')} wide />
                <FirField label={t('incidentLocation')} value={doc.incidentLocation} on={set('incidentLocation')} autoFilled={fieldConf('incidentLocation') !== null} wide />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-blue border-b border-nexus-border pb-1">3 · {t('incidentNarrative')}</h3>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nexus-text-secondary mt-3">{t('descriptionNote')}</label>
              <textarea
                value={doc.incidentDescription}
                onChange={e => setDoc(prev => ({ ...prev, incidentDescription: e.target.value }))}
                rows={5}
                className="w-full mt-1 border border-nexus-border rounded-lg p-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                title={fieldConf('incidentDescription') !== null ? 'Auto-filled by OCR — verify' : undefined}
              />
              <label className="block text-[10px] font-bold uppercase tracking-wider text-nexus-text-secondary mt-3">{t('evidenceSummaryLabel')}</label>
              <textarea
                value={doc.evidenceSummary}
                onChange={e => setDoc(prev => ({ ...prev, evidenceSummary: e.target.value }))}
                rows={2}
                className="w-full mt-1 border border-nexus-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
              />
            </div>

            {attachmentRows.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-blue border-b border-nexus-border pb-1">4 · {t('attachedEvidence')}</h3>
                <table className="w-full mt-2 text-xs">
                  <thead>
                    <tr className="text-nexus-text-secondary text-left">
                      <th className="py-1 font-semibold">#</th>
                      <th className="py-1 font-semibold">{t('evFile')}</th>
                      <th className="py-1 font-semibold">{t('evKind')}</th>
                      <th className="py-1 font-semibold">{t('evSize')}</th>
                      <th className="py-1 font-semibold">{t('evChecksum')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachmentRows.map((a, i) => (
                      <tr key={a.id} className="border-t border-nexus-border">
                        <td className="py-1 pr-2">{String(i + 1).padStart(2, '0')}</td>
                        <td className="py-1 pr-2 font-medium">{a.name}</td>
                        <td className="py-1 pr-2">{a.note || a.kind}</td>
                        <td className="py-1 pr-2">{a.size}</td>
                        <td className="py-1 font-mono">{a.checksum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 flex items-end justify-between gap-4 border-t border-nexus-border pt-5">
              <div className="text-xs text-nexus-text-secondary">
                <p>{t('actionTaken')}: ______________________________</p>
                <p className="mt-1">{t('ioInCharge')}: <span className="font-semibold text-nexus-text">{doc.ioName}</span> ({doc.ioRank})</p>
                <p className="mt-0.5 font-mono">{profile.badgeNumber}</p>
              </div>
              <div className="text-center">
                <div className="w-40 h-12 border-b border-nexus-text/60" />
                <p className="text-[10px] text-nexus-text-secondary mt-1">{t('signatureOfIo')} · {new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </div>

            <p className="mt-6 text-[9px] text-nexus-text-secondary border-t border-nexus-border pt-2 text-center">
              {t('firFooter')} — {docRef}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function firHtml(d: Omit<FirDocument, 'id' | 'createdAt' | 'createdBy'>): string {
  const rows = (doc: Omit<FirDocument, 'id' | 'createdAt' | 'createdBy'>): string => {
    const f = (label: string, value: string) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #000;width:42%;font-weight:bold">${label}</td>
        <td style="padding:6px 8px;border:1px solid #000">${value || '—'}</td>
      </tr>`;
    return [
      f('Police Station', doc.policeStation),
      f('District / State', `${doc.district}, ${doc.state}`),
      f('FIR No.', doc.firNumber),
      f('Date & Time of Incident', `${doc.incidentDate} ${doc.incidentTime}`.trim()),
      f('Sections / Acts', doc.sectionsLaw),
      f('Complainant', doc.complainantName),
      f('Complainant Age', doc.complainantAge),
      f("Father's Name", doc.complainantFather),
      f('Complainant Address', doc.complainantAddress),
      f('Complainant Phone', doc.complainantPhone),
      f('Accused / Subject', doc.subjectName),
      f('Aliases', doc.subjectAliases),
      f('Other Accused', doc.accusedDetails),
      f('Incident Location', doc.incidentLocation),
    ].join('');
  };
  const attRows = d.attachments.map((a, i) => `
    <tr><td style="padding:4px 8px;border:1px solid #000">${i + 1}</td><td style="padding:4px 8px;border:1px solid #000">${a.name}</td><td style="padding:4px 8px;border:1px solid #000">${a.note || a.kind}</td><td style="padding:4px 8px;border:1px solid #000">${a.size}</td><td style="padding:4px 8px;border:1px solid #000">${a.checksum}</td></tr>`).join('');
  return `
<html xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="utf-8">
<title>FIR ${d.firNumber}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000; }
  h1 { text-align: center; font-size: 20pt; letter-spacing: 2px; margin: 0 0 4px; }
  .sub { text-align: center; font-size: 9pt; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
  .notes { margin-top: 12px; }
  .sect { font-size: 10pt; font-weight: bold; margin-top: 14px; border-bottom: 1px solid #000; }
  .sign { margin-top: 24px; text-align: right; }
</style></head>
<body>
  <p class="sub">Government of ${d.state}<br/>Police Headquarters</p>
  <h1>FIRST INFORMATION REPORT</h1>
  <p class="sub">Police Station: ${d.policeStation || '—'} · District: ${d.district}, ${d.state}</p>
  <table>${rows(d)}</table>
  <div class="sect">Narrative / Description of Incident</div>
  <p class="notes">${d.incidentDescription || '—'}</p>
  <div class="sect">Property / Evidence Summary</div>
  <p class="notes">${d.evidenceSummary || '—'}</p>
  ${attRows ? `<div class="sect">Attached Evidence</div><table><thead><tr><th>#</th><th>File</th><th>Kind</th><th>Size</th><th>Checksum</th></tr></thead><tbody>${attRows}</tbody></table>` : ''}
  <div class="sign">
    <p>IO In-charge: ${d.ioName} (${d.ioRank})</p>
    <p>Signature: ______________________</p>
  </div>
</body></html>`;
}