import { useApp } from '../store';
import { riskColor } from '../utils/theme';
import type { Anomaly, Entity } from '../types';

const COMMUNITY_COLORS = ['#0B3D91', '#16A34A', '#F59E0B', '#DC2626'];

export default function PatternAnomaly() {
  const { t, openProfile, communities, anomalies, entities } = useApp();

  const anomalyIcons: Record<Anomaly['type'], string> = {
    new_contact_before_crime: '⚠',
    burner_phone: '🔥',
    bridge_node: '🌉',
    unusual_pattern: '📊',
  };

  const anomalyColors: Record<Anomaly['severity'], string> = {
    high: 'border-red-300 bg-red-50',
    medium: 'border-amber-300 bg-amber-50',
    low: 'border-blue-300 bg-blue-50',
  };

  const anomalyLabels: Record<Anomaly['type'], string> = {
    new_contact_before_crime: t('newContact'),
    burner_phone: t('burnerPhone'),
    bridge_node: t('bridgeNode'),
    unusual_pattern: t('unusualPattern'),
  };

  const severityLabels: Record<Anomaly['severity'], string> = {
    high: t('severityHigh'),
    medium: t('severityMedium'),
    low: t('severityLow'),
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-nexus-text">{t('patterns')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communities */}
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
          <div className="px-5 py-4 border-b border-nexus-border">
            <h2 className="font-semibold text-lg">{t('subGroups')}</h2>
          </div>
          <div className="p-4 space-y-4">
            {communities.map((comm, i) => {
      const members = comm.members.map(m => entities.find(e => e.id === m)).filter((x): x is Entity => !!x).filter(m => m.type === 'person');
      const color = COMMUNITY_COLORS[i % COMMUNITY_COLORS.length];
      return (
        <div key={comm.id} className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: color }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
                      {i}
                    </span>
                    <span className="font-semibold text-sm">{t('community')} #{i}</span>
                    <span className="text-xs text-nexus-text-secondary">({members.length} {t('members')})</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => m && (
                      <button
                        key={m.id}
                        onClick={() => { openProfile(m.id); }}
                        className="px-2 py-1 text-xs rounded-md bg-white border border-nexus-border hover:bg-nexus-surface transition font-medium"
                      >
                        {m.name.split(' ')[0]}
                        <span className="ml-1 w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: riskColor(m.riskScore) }} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
          <div className="px-5 py-4 border-b border-nexus-border">
            <h2 className="font-semibold text-lg">{t('anomalies')}</h2>
          </div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {anomalies.map(a => (
              <div key={a.id} className={`p-4 rounded-xl border-2 ${anomalyColors[a.severity]}`}>
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0" aria-hidden="true">{anomalyIcons[a.type]}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${a.severity === 'high' ? 'bg-red-200 text-red-800' : a.severity === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>
                        {severityLabels[a.severity]}
                      </span>
                      <span className="text-xs font-medium text-nexus-text-secondary">{anomalyLabels[a.type]}</span>
                    </div>
                    <p className="text-sm leading-relaxed mt-1">{a.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.entityIds.map(eid => {
                        const ent = entities.find(e => e.id === eid);
                        if (!ent) return null;
                        return (
                          <button
                            key={eid}
                            onClick={() => { openProfile(eid); }}
                            className="px-2 py-0.5 text-xs rounded bg-white border border-nexus-border hover:bg-nexus-surface transition"
                          >
                            {ent.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
