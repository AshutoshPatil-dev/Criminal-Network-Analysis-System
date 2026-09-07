import { useState } from 'react';
import { useApp } from '../store';
import type { DetailKind, ReportDetail, SubmittedReport } from '../types';
import type { TranslationKey } from '../i18n';
import { uploadCdrFile } from '../lib/supabase';
import { checksumFile } from '../lib/checksum';
import { runLinkAnalysis } from '../lib/aiAnalyzer';

type KindLabelKey =
  | 'detailPhone' | 'detailCallRecords' | 'detailAddress' | 'detailVehicle' | 'detailEmail'
  | 'detailSocial' | 'detailBank' | 'detailTransactionHistory' | 'detailAlias' | 'detailEmployer';

const KIND_ORDER: DetailKind[] = ['phone', 'call_records', 'address', 'vehicle', 'email', 'social', 'bank', 'transaction_history', 'alias', 'employer'];

const KIND_LABEL_KEY: Record<DetailKind, KindLabelKey> = {
  phone: 'detailPhone',
  call_records: 'detailCallRecords',
  address: 'detailAddress',
  vehicle: 'detailVehicle',
  email: 'detailEmail',
  social: 'detailSocial',
  bank: 'detailBank',
  transaction_history: 'detailTransactionHistory',
  alias: 'detailAlias',
  employer: 'detailEmployer',
};

const KIND_COLOR: Record<DetailKind, string> = {
  phone: '#7C3AED',
  call_records: '#DC2626',
  address: '#16A34A',
  vehicle: '#F97316',
  email: '#2563EB',
  social: '#4F46E5',
  bank: '#D97706',
  transaction_history: '#0EA5E9',
  alias: '#475569',
  employer: '#0D9488',
};

const KIND_META: Record<DetailKind, 'default' | 'address' | 'phone' | 'vehicle' | 'email' | 'social' | 'bank' | 'txn' | 'file'> = {
  phone: 'phone',
  call_records: 'file',
  address: 'address',
  vehicle: 'vehicle',
  email: 'email',
  social: 'social',
  bank: 'bank',
  transaction_history: 'txn',
  alias: 'default',
  employer: 'default',
};

const TAG_KEYS = ['burner', 'suspicious', 'verified', 'shared'] as const;
type TagKey = typeof TAG_KEYS[number];
const TAG_STYLE: Record<TagKey, string> = {
  burner: 'bg-red-100 text-red-800 border-red-300',
  suspicious: 'bg-amber-100 text-amber-800 border-amber-300',
  verified: 'bg-green-100 text-green-800 border-green-300',
  shared: 'bg-blue-100 text-blue-800 border-blue-300',
};

const pad = (n: number) => String(n).padStart(3, '0');

export default function ReportEntry() {
  const { t, addAuditLog, registerReport, submittedReports, pushFindingsToast, entities, relationships, crimeEvents, centralityScores } = useApp();

  const [name, setName] = useState('');
  const [firNumber, setFirNumber] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [kind, setKind] = useState<DetailKind | ''>('');
  const [valueInput, setValueInput] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; checksum: string; file?: File } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [tags, setTags] = useState<TagKey[]>([]);
  const [details, setDetails] = useState<ReportDetail[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const pendingRef = `REPORT-2026-${pad(submittedReports.length + 1)}`;
  const pendingStamp = `2026-04-${String(28).padStart(2, '0')}`;

  const kindLabel = (k: DetailKind) => t(KIND_LABEL_KEY[k]);

  const inputForKind = (k: DetailKind): { type: string; placeholder: string } | null => {
    const meta = KIND_META[k];
    if (meta === 'file') return null;
    switch (meta) {
      case 'address': return { type: 'textarea', placeholder: t('detailAddressPlaceholder') };
      case 'phone': return { type: 'text', placeholder: t('detailPhonePlaceholder') };
      case 'vehicle': return { type: 'text', placeholder: t('detailVehiclePlaceholder') };
      case 'email': return { type: 'email', placeholder: t('detailEmailPlaceholder') };
      case 'social': return { type: 'text', placeholder: t('detailSocialPlaceholder') };
      case 'bank': return { type: 'text', placeholder: t('detailBankPlaceholder') };
      case 'txn': return { type: 'text', placeholder: t('detailTxnPlaceholder') };
      default: return { type: 'text', placeholder: t('detailValuePlaceholder') };
    }
  };

  const clearEntryAfterAdd = () => {
    setValueInput('');
    setFileInfo(null);
    setNoteInput('');
    setTags([]);
    setEditId(null);
    setNotice(null);
  };

  const resetEntryInput = () => {
    setKind('');
    clearEntryAfterAdd();
  };

  const toggleTag = (tagKey: TagKey) =>
    setTags(prev => prev.includes(tagKey) ? prev.filter(x => x !== tagKey) : [...prev, tagKey]);

  const addOrUpdate = () => {
    if (!kind) return;
    if (!name.trim()) { setNotice(t('includeMandatory')); return; }
    if ((KIND_META[kind] !== 'file' && !valueInput.trim()) || (KIND_META[kind] === 'file' && !fileInfo)) {
      setNotice(t('includeValue'));
      return;
    }
    setNotice(null);

    const common = { note: noteInput.trim() || undefined, tags: tags.length ? [...tags] : undefined };

    if (editId) {
      setDetails(prev => prev.map(d => d.id === editId ? { ...d, kind, value: valueInput.trim() || fileInfo?.name || '', meta: fileInfo ? `${fileInfo.size} · ${fileInfo.checksum}` : d.meta, ...common, createdAt: new Date().toISOString() } : d));
      addAuditLog({ action: 'edit_detail', level: 'info', summary: `Edited ${kindLabel(kind)} for ${name.trim()}.`, target: `person ${name.trim()}` });
      resetEntryInput();
    } else {
      const newDetail: ReportDetail = {
        id: `d-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        kind,
        value: kind === 'call_records' && fileInfo ? fileInfo.name : valueInput.trim(),
        meta: kind === 'call_records' && fileInfo ? `${fileInfo.size} · ${fileInfo.checksum}` : undefined,
        ...common,
        createdAt: new Date().toISOString(),
      };
      setDetails(prev => [...prev, newDetail]);
      addAuditLog({ action: 'add_detail', level: 'info', summary: `Added ${kindLabel(kind)} ${newDetail.value} for ${name.trim()}.`, target: `person ${name.trim()}` });
      if (newDetail.kind === 'call_records' && fileInfo?.file) {
        void uploadCdrFile('case-files', fileInfo.file)
          .then(res => {
            if (res) {
              setDetails(prev => prev.map(x => x.id === newDetail.id ? { ...x, meta: (x.meta || '') + ` · ${res.storagePath}` } : x));
            }
          })
          .catch(() => { /* offline — metadata only */ });
      }
      clearEntryAfterAdd();
    }
  };

  const removeDetail = (d: ReportDetail) => {
    setDetails(prev => prev.filter(x => x.id !== d.id));
    addAuditLog({ action: 'remove_detail', level: 'warn', summary: `Removed ${kindLabel(d.kind)} ${d.value} from ${name.trim() || 'draft'} — revisit for correctness.`, target: `person ${name.trim() || 'draft'}` });
  };

  const beginEdit = (d: ReportDetail) => {
    setEditId(d.id);
    setKind(d.kind);
    setValueInput(d.kind !== 'call_records' ? d.value : '');
    setNoteInput(d.note || '');
    setTags((d.tags || []).filter((x): x is TagKey => (TAG_KEYS as readonly string[]).includes(x)) as TagKey[]);
    if (d.kind === 'call_records' && d.meta) {
      setFileInfo({ name: d.value, size: d.meta.split(' · ')[0] || '—', checksum: d.meta.split(' · ')[1] || '—' });
    } else {
      setFileInfo(null);
    }
  };

  const submit = () => {
    if (!name.trim()) { setNotice(t('includeMandatory')); return; }
    const report: SubmittedReport = {
      id: '',
      firNumber: firNumber.trim() || '—',
      incidentLocation: incidentLocation.trim() || undefined,
      subjectName: name.trim(),
      detailCount: details.length,
      details: [...details],
      submittedAt: new Date().toISOString(),
      submittedBy: '',
    };
    const ref = registerReport({
      firNumber: report.firNumber,
      incidentLocation: report.incidentLocation,
      subjectName: report.subjectName,
      detailCount: details.length,
      details: [...details],
    });
    addAuditLog({ action: 'submit_report', level: 'info', summary: `Submitted report for ${name.trim()} with ${details.length} detail${details.length === 1 ? '' : 's'}.`, target: ref });
    const scan = runLinkAnalysis({
      entities, relationships, crimeEvents,
      centrality: Object.fromEntries(centralityScores.map(c => [c.entityId, c.pageRank])),
      reports: [{ ...report, id: ref, submittedBy: '' }],
    });
    const subjectLinks = scan.findings.filter(f => f.subject === report.subjectName);
    if (subjectLinks.length > 0) {
      pushFindingsToast(subjectLinks.length, report.subjectName);
    }
    setJustSubmitted(ref);
    setName('');
    setFirNumber('');
    setIncidentLocation('');
    setIncidentDate('');
    setDetails([]);
    resetEntryInput();
    setNotice(null);
    window.setTimeout(() => setJustSubmitted(null), 6000);
  };

  const fileInput = kind ? KIND_META[kind] === 'file' : false;

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nexus-text">{t('newReportTitle')}</h1>
        <p className="text-sm text-nexus-text-secondary mt-1">{t('newReportSteps')}</p>
      </div>

      {justSubmitted && (
        <div className="bg-green-50 border border-green-300 rounded-xl px-4 py-3 flex items-center gap-3" role="status">
          <span className="text-xl" aria-hidden="true">✓</span>
          <div>
            <p className="font-semibold text-green-800">{t('submitSuccess')} — {justSubmitted}</p>
            <p className="text-sm text-green-700">{t('submitSuccessDetail')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: identity + details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Step 1 — identity */}
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-5" aria-label="Subject identity">
            <h2 className="font-semibold text-lg mb-1">1 · {t('subjectName')}</h2>
            <p className="text-sm text-nexus-text-secondary mb-4">{t('lawEnforcementUse')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="report-name" className="block text-sm font-medium text-nexus-text mb-1">{t('subjectName')} <span className="text-nexus-risk-high" aria-hidden="true">*</span></label>
                <input
                  id="report-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('subjectNamePlaceholder')}
                  className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="report-fir" className="block text-sm font-medium text-nexus-text mb-1">{t('firNumber')}</label>
                <input
                  id="report-fir"
                  type="text"
                  value={firNumber}
                  onChange={e => setFirNumber(e.target.value)}
                  placeholder="2026/0000"
                  className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                />
              </div>
              <div>
                <label htmlFor="report-location" className="block text-sm font-medium text-nexus-text mb-1">{t('incidentLocation')}</label>
                <input
                  id="report-location"
                  type="text"
                  value={incidentLocation}
                  onChange={e => setIncidentLocation(e.target.value)}
                  placeholder={t('incidentLocationPlaceholder')}
                  className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                />
              </div>
              <div>
                <label htmlFor="report-date" className="block text-sm font-medium text-nexus-text mb-1">{t('incidentDate')}</label>
                <input
                  id="report-date"
                  type="date"
                  value={incidentDate}
                  max="2026-04-30"
                  onChange={e => setIncidentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                />
              </div>
            </div>
          </section>

          {/* Step 2 — add details */}
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-5" aria-label="Add details">
            <h2 className="font-semibold text-lg mb-1">2 · {t('addEvidenceDetails')}</h2>
            <p className="text-sm text-nexus-text-secondary mb-4">{t('previewHint')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="detail-kind" className="block text-sm font-medium text-nexus-text mb-1">{t('chooseDetailType')}</label>
                <select
                  id="detail-kind"
                  value={kind}
                  onChange={e => { setKind(e.target.value as DetailKind | ''); setValueInput(''); setFileInfo(null); }}
                  className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                >
                  <option value="">{t('chooseDetailType')}</option>
                  {KIND_ORDER.map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="detail-value" className="block text-sm font-medium text-nexus-text mb-1">
                  {kindLabel((kind as DetailKind) || 'phone')}
                </label>
                {!kind ? (
                  <p className="px-3 py-2 text-sm text-nexus-text-secondary border border-dashed border-nexus-border rounded-lg">{t('chooseDetailType')}</p>
                ) : fileInput ? (
                  <div className="flex items-stretch gap-2">
                    <label className="flex-1 px-3 py-2 border-2 border-dashed border-nexus-border rounded-lg text-sm text-nexus-text-secondary cursor-pointer hover:bg-nexus-surface transition text-center flex items-center justify-center gap-2">
                      <span aria-hidden="true">⬆</span> {fileInfo ? fileInfo.name : t('detailFileButton')}
                      <input
                        id="report-file"
                        type="file"
                        accept=".csv,.xlsx,.json"
                        className="sr-only"
                        onChange={async e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setFileInfo({ name: f.name, size: `${(f.size / 1024).toFixed(1)} KB`, checksum: '…', file: f });
                          setValueInput(f.name);
                          const checksum = await checksumFile(f);
                          setFileInfo(prev => (prev?.file === f ? { ...prev, checksum } : prev));
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  (() => {
                    const cfg = inputForKind(kind as DetailKind);
                    if (!cfg) return null;
                    if (cfg.type === 'textarea') {
                      return (
                        <textarea
                          id="detail-value"
                          value={valueInput}
                          onChange={e => setValueInput(e.target.value)}
                          placeholder={cfg.placeholder}
                          rows={2}
                          className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue resize-none"
                        />
                      );
                    }
                    return (
                      <input
                        id="detail-value"
                        type={cfg.type}
                        value={valueInput}
                        onChange={e => setValueInput(e.target.value)}
                        placeholder={cfg.placeholder}
                        className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                      />
                    );
                  })()
                )}
                {fileInput && (
                  <p className="text-xs text-nexus-text-secondary mt-1">{t('detailFileHint')}</p>
                )}
              </div>
            </div>

            {kind && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <div>
                  <label htmlFor="detail-note" className="block text-sm font-medium text-nexus-text mb-1">{t('noteLabel')}</label>
                  <input
                    id="detail-note"
                    type="text"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder={t('notePlaceholder')}
                    className="w-full px-3 py-2 border border-nexus-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-blue"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium text-nexus-text mb-1">{t('tagsLabel')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_KEYS.map(tk => {
                      const active = tags.includes(tk);
                      return (
                        <button
                          key={tk}
                          type="button"
                          onClick={() => toggleTag(tk)}
                          aria-pressed={active}
                          className={`px-2.5 py-1 rounded-full border text-xs font-medium transition ${active ? TAG_STYLE[tk] : 'border-nexus-border text-nexus-text-secondary hover:bg-nexus-surface'}`}
                        >
                          {active && <span aria-hidden="true">✓ </span>}
                          {t(('tag' + tk[0].toUpperCase() + tk.slice(1)) as TranslationKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {fileInput && fileInfo && (
              <div className="mt-3 p-3 bg-nexus-surface rounded-lg text-xs font-mono text-nexus-text-secondary">
                {fileInfo.name} · {fileInfo.size} · {fileInfo.checksum}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={addOrUpdate}
                disabled={!kind || (!fileInput && !valueInput.trim()) || (fileInput && !fileInfo)}
                className="px-4 py-2 rounded-lg bg-nexus-blue text-white text-sm font-semibold hover:bg-nexus-blue-light disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {editId ? t('updateDetail') : t('addDetail')}
              </button>
              {editId && (
                <button onClick={resetEntryInput} className="px-3 py-2 rounded-lg border border-nexus-border text-sm hover:bg-nexus-surface transition">
                  {t('cancelEdit')}
                </button>
              )}
            </div>

            {notice && <p className="mt-3 text-sm text-nexus-risk-high" role="alert">{notice}</p>}
          </section>

          {/* Draft details */}
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-5" aria-label="Draft details">
            <h3 className="font-semibold mb-3">{t('detailsAdded')} ({details.length})</h3>
            {details.length === 0 ? (
              <p className="text-sm text-nexus-text-secondary">{t('previewEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {details.map(d => (
                  <li key={d.id} className="p-3 rounded-lg border border-nexus-border flex items-start gap-3 hover:bg-nexus-surface transition">
                    <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold text-white flex-shrink-0" style={{ backgroundColor: KIND_COLOR[d.kind] }}>
                      {kindLabel(d.kind)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">{d.value}</p>
                      {d.meta && <p className="text-xs font-mono text-nexus-text-secondary mt-0.5">{d.meta}</p>}
                      {(d.note || (d.tags && d.tags.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {d.tags && d.tags.map(tk => (
                            <span key={tk} className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${TAG_STYLE[tk as TagKey] || 'border-nexus-border text-nexus-text-secondary'}`}>
                              {t(('tag' + (tk as string)[0].toUpperCase() + (tk as string).slice(1)) as TranslationKey)}
                            </span>
                          ))}
                          {d.note && <span className="text-xs italic text-nexus-text-secondary">“{d.note}”</span>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => beginEdit(d)}
                      className="px-2 py-1 text-xs rounded border border-nexus-border hover:bg-white transition flex-shrink-0"
                      aria-label={`Edit ${kindLabel(d.kind)}`}
                    >
                      {t('editDetail')}
                    </button>
                    <button
                      onClick={() => removeDetail(d)}
                      className="px-2 py-1 text-xs rounded border border-nexus-risk-high/30 text-nexus-risk-high hover:bg-red-50 transition flex-shrink-0"
                      aria-label={`Delete ${kindLabel(d.kind)}`}
                    >
                      {t('deleteDetail')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Right: preview */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border overflow-hidden" aria-label={t('preview')}>
            <div className="px-5 py-4 border-b border-nexus-border flex items-center justify-between bg-nexus-blue text-white">
              <div>
                <h2 className="font-semibold text-lg">{t('preview')}</h2>
                <p className="text-xs text-blue-200">{t('previewHint')}</p>
              </div>
              <span className="font-mono text-xs bg-white/20 rounded px-2 py-1">{pendingRef}</span>
            </div>
            <div className="p-5">
              <div className="rounded-xl border-2 border-nexus-blue/30 overflow-hidden">
                <div className="px-4 py-3 bg-nexus-surface border-b border-nexus-border flex items-center justify-between">
                  <span className="text-xs font-bold text-nexus-blue tracking-wide">{t('reportStamp')}</span>
                  <span className="text-xs font-mono text-nexus-text-secondary">{pendingStamp}</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium">{t('subjectName')}</p>
                    <p className="text-lg font-bold">{name.trim() || '—'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium">{t('firNumber')}</p>
                      <p className="font-mono">{firNumber.trim() || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium">{t('incidentDate')}</p>
                      <p className="font-mono">{incidentDate || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium">{t('incidentLocation')}</p>
                      <p className="font-medium">{incidentLocation.trim() || '—'}</p>
                    </div>
                  </div>
                  <div className="border-t border-nexus-border pt-3">
                    <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium mb-2">{t('detailsAdded')} ({details.length})</p>
                    {details.length === 0 ? (
                      <p className="text-sm text-nexus-text-secondary">{t('previewEmpty')}</p>
                    ) : (
                      <ul className="divide-y divide-nexus-border">
                        {details.map(d => (
                          <li key={d.id} className="py-2 flex items-start gap-2">
                            <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: KIND_COLOR[d.kind] }} aria-hidden="true" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-nexus-text-secondary">{kindLabel(d.kind)}</p>
                              <p className="text-sm font-medium break-words">{d.value}</p>
                              {d.meta && <p className="text-xs font-mono text-nexus-text-secondary">{d.meta}</p>}
                              {(d.note || (d.tags && d.tags.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  {d.tags && d.tags.map(tk => (
                                    <span key={tk} className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${TAG_STYLE[tk as TagKey] || 'border-nexus-border text-nexus-text-secondary'}`}>
                                      {t(('tag' + (tk as string)[0].toUpperCase() + (tk as string).slice(1)) as TranslationKey)}
                                    </span>
                                  ))}
                                  {d.note && <span className="text-[11px] italic text-nexus-text-secondary">“{d.note}”</span>}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeDetail(d)}
                              className="px-1.5 py-0.5 text-xs text-nexus-risk-high hover:bg-red-50 rounded transition flex-shrink-0"
                              aria-label={`Delete ${kindLabel(d.kind)}`}
                            >
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={submit}
                  disabled={!name.trim()}
                  className="flex-1 px-4 py-3 rounded-lg bg-nexus-accent text-nexus-blue font-bold hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {t('submitReport')}
                </button>
              </div>
              <p className="text-xs text-nexus-text-secondary mt-2">{t('submitReportHint')}</p>
            </div>
          </section>

          {/* Recently submitted */}
          <section className="bg-white rounded-xl shadow-sm border border-nexus-border p-5" aria-label={t('reportHistory')}>
            <h3 className="font-semibold mb-3">{t('reportHistory')}</h3>
            {submittedReports.length === 0 ? (
              <p className="text-sm text-nexus-text-secondary">{t('noReportsYet')}</p>
            ) : (
              <ul className="space-y-2">
                {submittedReports.slice(0, 6).map(r => (
                  <li key={r.id} className="p-3 rounded-lg border border-nexus-border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-nexus-blue">{r.id}</span>
                      <span className="text-xs text-nexus-text-secondary">{new Date(r.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{r.subjectName}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-nexus-text-secondary">
                      <span>{t('firNumber')}: <span className="font-mono">{r.firNumber}</span></span>
                      <span aria-hidden="true">·</span>
                      <span>{t('detailsAdded')}: {r.detailCount}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t('submittedBy')}: {r.submittedBy}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}