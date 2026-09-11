import { useMemo, useState } from 'react';
import { useApp } from '../store';
import type { AuditLogAction, AuditLogLevel } from '../types';
import { supabaseConfigured } from '../lib/supabase';

type Filter = 'all' | AuditLogLevel;

const ACTION_KEY: Record<AuditLogAction, 'actionCreateReport' | 'actionAddDetail' | 'actionEditDetail' | 'actionRemoveDetail' | 'actionSubmitReport' | 'actionAiScan' | 'actionLogin' | 'actionLogoff' | 'actionExport' | 'actionAccessDenied' | 'actionTamperDetected' | 'actionCreateOfficer' | 'actionUpdateOfficer' | 'actionDeleteOfficer' | 'actionOcrFir' | 'actionSaveFir' | 'actionUploadAttachment'> = {
  create_report: 'actionCreateReport',
  add_detail: 'actionAddDetail',
  edit_detail: 'actionEditDetail',
  remove_detail: 'actionRemoveDetail',
  submit_report: 'actionSubmitReport',
  ai_scan: 'actionAiScan',
  login: 'actionLogin',
  logoff: 'actionLogoff',
  export: 'actionExport',
  access_denied: 'actionAccessDenied',
  tamper_detected: 'actionTamperDetected',
  create_officer: 'actionCreateOfficer',
  update_officer: 'actionUpdateOfficer',
  delete_officer: 'actionDeleteOfficer',
  ocr_fir: 'actionOcrFir',
  save_fir: 'actionSaveFir',
  upload_attachment: 'actionUploadAttachment',
};

const LEVEL_BADGE: Record<AuditLogLevel, string> = {
  info: 'bg-blue-100 text-blue-800',
  warn: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
};

const isTamperLike = (action: AuditLogAction) => action === 'tamper_detected' || action === 'access_denied';

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function AuditLogs() {
  const { t, auditLogs, submittedReports } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const stats = useMemo(() => {
    const critical = auditLogs.filter(l => l.level === 'critical').length;
    const warn = auditLogs.filter(l => l.level === 'warn').length;
    const tamper = auditLogs.filter(l => isTamperLike(l.action)).length;
    return { total: auditLogs.length, warn, critical, tamper };
  }, [auditLogs]);

  const visible = filter === 'all' ? auditLogs : auditLogs.filter(l => l.level === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('allLevels') },
    { key: 'info', label: t('infoLevel') },
    { key: 'warn', label: t('warnLevel') },
    { key: 'critical', label: t('criticalLevel') },
  ];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nexus-text">{t('logsTitle')}</h1>
        <p className="text-sm text-nexus-text-secondary mt-1">{t('logsSubtitle')}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
          <p className="text-xs uppercase tracking-wide text-nexus-text-secondary font-medium">{t('allLevels')}</p>
          <p className="text-3xl font-mono font-bold text-nexus-text mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-medium">{t('warnCount')}</p>
          <p className="text-3xl font-mono font-bold text-amber-600 mt-1">{stats.warn}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-4">
          <p className="text-xs uppercase tracking-wide text-red-700 font-medium">{t('criticalCount')}</p>
          <p className="text-3xl font-mono font-bold text-nexus-risk-high mt-1">{stats.critical}</p>
        </div>
        <div
          className={`rounded-xl shadow-sm border p-4 ${stats.tamper > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}
          role="status"
          aria-label={t('logStatsTitle')}
        >
          <p className="text-xs uppercase tracking-wide text-red-800 font-medium">{t('tamperCount')}</p>
          <p className="text-3xl font-mono font-bold mt-1" style={{ color: stats.tamper > 0 ? '#DC2626' : '#16A34A' }}>{stats.tamper}</p>
          <p className="text-xs font-medium mt-1" style={{ color: stats.tamper > 0 ? '#B91C1C' : '#15803D' }}>
            {stats.tamper > 0 ? t('logStatsDesc') : t('allClear')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
        {/* Filter chips */}
        <div className="px-5 py-3 border-b border-nexus-border flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold mr-2">{t('filterLevel')}:</span>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-sm transition ${filter === f.key ? 'bg-nexus-blue text-white' : 'bg-nexus-surface hover:bg-nexus-border'}`}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </button>
          ))}
          <span className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${supabaseConfigured ? 'bg-green-100 text-green-800' : 'bg-nexus-surface text-nexus-text-secondary'}`} role="status">
            <span className={`w-1.5 h-1.5 rounded-full ${supabaseConfigured ? 'bg-green-600' : 'bg-amber-500'}`} aria-hidden="true" />
            {supabaseConfigured ? t('supConnected') : t('supOffline')}
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="p-8 text-center text-nexus-text-secondary">{t('noLogs')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t('logsTitle')}>
              <thead>
                <tr className="text-nexus-text-secondary text-xs uppercase border-b border-nexus-border">
                  <th className="text-left px-4 py-2 w-36">{t('timeCol')}</th>
                  <th className="text-left px-4 py-2 w-44">{t('actorCol')}</th>
                  <th className="text-left px-4 py-2 w-40">{t('actionCol')}</th>
                  <th className="text-left px-4 py-2">{t('summaryCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {visible.map(l => (
                  <tr
                    key={l.id}
                    className={`hover:bg-nexus-surface transition ${l.level === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-nexus-text-secondary whitespace-nowrap">{fmtTime(l.timestamp)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: isTamperLike(l.action) ? '#DC2626' : '#0B3D91' }}
                          aria-hidden="true"
                        >
                          {(l.actor === 'system' ? 'S' : l.actor.split(' ').map(w => w[0]).join('').slice(0, 2)).toUpperCase()}
                        </span>
                        <span className="font-medium">{l.actor}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${LEVEL_BADGE[l.level]}`}>
                        {t(ACTION_KEY[l.action])}
                      </span>
                      {isTamperLike(l.action) && (
                        <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-black bg-red-600 text-white tracking-wide">
                          {t('tamperAttempt')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.summary}
                      {l.target && <span className="ml-1 font-mono text-xs text-nexus-text-secondary">→ {l.target}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submitted reports that generated audit entries */}
      {submittedReports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
          <h2 className="font-semibold text-lg mb-3">{t('reportHistory')}</h2>
          <div className="flex flex-wrap gap-3">
            {submittedReports.map(r => (
              <div key={r.id} className="p-3 rounded-lg border border-nexus-border min-w-[220px]">
                <p className="font-mono text-xs font-bold text-nexus-blue">{r.id}</p>
                <p className="text-sm font-medium mt-1">{r.subjectName}</p>
                <p className="text-xs text-nexus-text-secondary mt-1">{t('detailsAdded')}: {r.detailCount} · {fmtTime(r.submittedAt)}</p>
                {r.incidentLocation && <p className="text-xs text-nexus-text-secondary mt-1">{t('incidentLocation')}: {r.incidentLocation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}