import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { runLinkAnalysis, type AnalysisFinding, type LinkAnalysisResult } from '../lib/aiAnalyzer';
import { riskColor } from '../utils/theme';

const KIND_ICON: Record<AnalysisFinding['kind'], string> = {
  identity_match: '▣',
  mastermind_link: '◆',
  crime_link: '⚠',
  risk_signal: '✚',
  cross_report: '⇄',
  network_surfaced: '◉',
};

const KIND_COLOR: Record<AnalysisFinding['kind'], string> = {
  identity_match: '#0B3D91',
  mastermind_link: '#7C3AED',
  crime_link: '#DC2626',
  risk_signal: '#D97706',
  cross_report: '#0D9488',
  network_surfaced: '#0891B2',
};

const SEV_STYLE: Record<AnalysisFinding['severity'], string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-blue-100 text-blue-800',
};

const SCAN_STEP_COUNT = 4;

export default function AiAnalysis() {
  const { t, addAuditLog, submittedReports, openProfile, entities, relationships, crimeEvents, centralityScores } = useApp();
  const [scanning, setScanning] = useState(true);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<LinkAnalysisResult | null>(null);

  const scanSteps = [t('scanStep1'), t('scanStep2'), t('scanStep3'), t('scanStep4')];

  const sevLabel = (s: string): string =>
    s === 'high' ? t('severityHigh') : s === 'medium' ? t('severityMedium') : t('severityLow');

  const run = () => {
    setScanning(true);
    setStep(0);
    setResult(null);
    window.setTimeout(() => {
      const centrality = Object.fromEntries(centralityScores.map(c => [c.entityId, c.pageRank]));
      const res = runLinkAnalysis({ entities, relationships, crimeEvents, centrality, reports: submittedReports });
      setResult(res);
      setScanning(false);
      addAuditLog({
        action: 'ai_scan',
        level: 'info',
        summary: `AI link analysis completed — ${res.findings.length} finding${res.findings.length === 1 ? '' : 's'}, ${res.masterminds.length} mastermind${res.masterminds.length === 1 ? '' : 's'} surfaced.`,
        target: `${submittedReports.length} report${submittedReports.length === 1 ? '' : 's'}`,
      });
    }, 1500);
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [entities.length, relationships.length, crimeEvents.length, submittedReports.length]);

  useEffect(() => {
    if (!scanning) return;
    const id = window.setInterval(() => setStep(s => (s + 1) % SCAN_STEP_COUNT), 420);
    return () => window.clearInterval(id);
  }, [scanning]);

  const findings = result ? [...result.findings].sort((a, b) =>
    ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity])) : [];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">{t('aiAnalysis')}</h1>
          <p className="text-sm text-nexus-text-secondary mt-1">{t('aiTagline')}</p>
        </div>
        <button
          onClick={run}
          disabled={scanning}
          className="px-4 py-2 rounded-lg bg-nexus-blue text-white text-sm font-semibold hover:bg-nexus-blue-light disabled:opacity-40 disabled:cursor-wait transition"
        >
          {scanning ? `… ${scanSteps[step]}` : `✦ ${t('runScan')}`}
        </button>
      </div>

      {scanning && (
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-10 text-center" role="status">
          <div className="mx-auto mb-4 w-12 h-12 border-4 border-nexus-blue/20 border-t-nexus-blue rounded-full animate-spin" aria-hidden="true" />
          <p className="font-medium text-nexus-text">{scanSteps[step]}</p>
        </div>
      )}

      {!scanning && result && (
        <>
          {/* Analyst brief */}
          <div className="bg-gradient-to-br from-nexus-blue to-nexus-blue-dark text-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-lg mb-2">🜁 {t('briefTitle')}</h2>
            <p className="text-sm leading-relaxed text-blue-100">{result.brief}</p>
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <span className="px-2 py-1 rounded bg-white/15 font-mono">{result.findings.length} {t('findingsCol').toLowerCase()}</span>
              <span className="px-2 py-1 rounded bg-white/15 font-mono">{result.masterminds.length} {t('mastermindTitle').toLowerCase()}</span>
              <span className="px-2 py-1 rounded bg-white/15 font-mono">{submittedReports.length} {t('reportsSource')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Findings */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-semibold text-lg">{t('findingsCol')} ({findings.length})</h2>
              {findings.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-10 text-center">
                  <p className="text-nexus-text-secondary">{t('noFindings')}</p>
                </div>
              )}
              {findings.map(f => (
                <article key={f.id} className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: KIND_COLOR[f.kind] }}
                      aria-hidden="true"
                    >
                      {KIND_ICON[f.kind]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${SEV_STYLE[f.severity]}`}>{sevLabel(f.severity)}</span>
                        <span className="text-xs font-medium text-nexus-text-secondary">{f.subject}</span>
                        <span className="text-[10px] font-mono text-nexus-text-secondary">{f.sourceRef}</span>
                      </div>
                      <h3 className="font-semibold leading-snug">{f.title}</h3>
                      <p className="text-sm text-nexus-text-secondary leading-relaxed mt-1">{f.detail}</p>

                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="font-medium text-nexus-text-secondary">{t('confidence')}</span>
                        <div className="w-28 h-1.5 bg-nexus-surface rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${f.confidence}%`, backgroundColor: f.confidence >= 85 ? '#16A34A' : f.confidence >= 60 ? '#F59E0B' : '#64748B' }} />
                        </div>
                        <span className="font-mono">{f.confidence}%</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        {f.linkedEntityName && (
                          <button
                            onClick={() => { if (f.linkedEntityId) openProfile(f.linkedEntityId); }}
                            className="px-2 py-1 text-xs rounded bg-nexus-blue/10 text-nexus-blue font-semibold hover:bg-nexus-blue/20 transition"
                          >
                            {t('openProfile')}: {f.linkedEntityName}
                          </button>
                        )}
                        {f.evidence.map((ev, i) => (
                          <span key={i} className="px-2 py-1 text-[10px] font-mono rounded bg-nexus-surface border border-nexus-border text-nexus-text-secondary">
                            {ev}
                          </span>
                        ))}
                      </div>

                      <p className="mt-3 pt-3 border-t border-nexus-border text-sm">
                        <span className="font-medium text-nexus-text-secondary">{t('actionTitle')}:</span>{' '}
                        <span className="text-nexus-text">{f.action}</span>
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Mastermind watch */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">{t('mastermindTitle')} <span className="text-nexus-text-secondary font-normal">({result.masterminds.length})</span></h2>
              {result.masterminds.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-6 text-sm text-nexus-text-secondary">{t('noFindings')}</div>
              )}
              <div className="space-y-3">
                {result.masterminds.map((m, i) => (
                  <button
                    key={m.entityId}
                    onClick={() => { openProfile(m.entityId); }}
                    className="w-full bg-white rounded-xl shadow-sm border border-nexus-border p-4 text-left hover:bg-nexus-surface transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: riskColor(m.riskScore) }} aria-hidden="true">
                        {m.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{m.name}</span>
                          <span className="text-xs text-nexus-text-secondary hidden sm:inline">#{i + 1}</span>
                        </div>
                        <p className="text-xs text-nexus-text-secondary capitalize">{m.role || m.entityId}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-mono font-bold" style={{ color: riskColor(m.riskScore) }}>R{m.riskScore}</p>
                        <p className="text-[10px] font-mono text-nexus-text-secondary">PR {(m.pageRank * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-nexus-text-secondary border-t border-nexus-border pt-2">
                      <span><strong className="text-nexus-text">{m.links}</strong> {t('linksSurfaced')}</span>
                      <span><strong className="text-nexus-text">{m.inCrimes}</strong> {t('firShort')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}