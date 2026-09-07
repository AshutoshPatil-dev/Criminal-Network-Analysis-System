import { useApp } from '../store';
import { centralityScores, communities, anomalies, entities } from '../data/mockData';
import { riskColor, entityTypeColors } from '../utils/theme';
import type { Anomaly } from '../types';

export default function PatternAnomaly() {
  const { t, openProfile } = useApp();

  const sortedByCentrality = [...centralityScores].sort((a, b) => b.pageRank - a.pageRank);

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

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-nexus-text">{t('patterns')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Influencers */}
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
          <div className="px-5 py-4 border-b border-nexus-border">
            <h2 className="font-semibold text-lg">{t('influence')} — {t('centrality')}</h2>
          </div>
          <div className="p-4 overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm" aria-label="Centrality scores">
              <thead>
                <tr className="text-nexus-text-secondary text-xs uppercase">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-right py-2">{t('degree')}</th>
                  <th className="text-right py-2">{t('betweenness')}</th>
                  <th className="text-right py-2">{t('pageRank')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nexus-border">
                {sortedByCentrality.map((cs, i) => {
                  const entity = entities.find(e => e.id === cs.entityId);
                  if (!entity) return null;
                  return (
                    <tr
                      key={cs.entityId}
                      className="hover:bg-nexus-surface cursor-pointer"
                      onClick={() => { openProfile(cs.entityId); }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${entity.name} profile`}
                    >
                      <td className="py-2.5 font-mono text-nexus-text-secondary">{i + 1}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded flex items-center justify-center text-white text-xs" style={{ backgroundColor: entityTypeColors[entity.type] }} aria-hidden="true">{entity.name.charAt(0)}</span>
                          <div>
                            <p className="font-medium truncate max-w-[120px]">{entity.name.split(' ')[0]}</p>
                            <p className="text-xs text-nexus-text-secondary">{entity.attributes.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-10 h-1.5 bg-nexus-surface rounded-full overflow-hidden">
                            <div className="h-full bg-nexus-blue rounded-full" style={{ width: `${cs.degree * 100}%` }} />
                          </div>
                          <span className="font-mono text-xs w-8">{(cs.degree * 100).toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-10 h-1.5 bg-nexus-surface rounded-full overflow-hidden">
                            <div className="h-full bg-nexus-risk-medium rounded-full" style={{ width: `${cs.betweenness * 100}%` }} />
                          </div>
                          <span className="font-mono text-xs w-8">{(cs.betweenness * 100).toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="w-10 h-1.5 bg-nexus-surface rounded-full overflow-hidden">
                            <div className="h-full bg-nexus-risk-high rounded-full" style={{ width: `${cs.pageRank * 500}%` }} />
                          </div>
                          <span className="font-mono text-xs w-8">{(cs.pageRank * 100).toFixed(1)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Communities */}
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
          <div className="px-5 py-4 border-b border-nexus-border">
            <h2 className="font-semibold text-lg">{t('subGroups')}</h2>
          </div>
          <div className="p-4 space-y-4">
            {communities.map((comm, i) => {
              const members = comm.members.filter(m => m.startsWith('p')).map(m => entities.find(e => e.id === m)).filter(Boolean);
              return (
                <div key={comm.id} className="p-4 rounded-xl border-2 border-dashed" style={{ borderColor: ['#0B3D91', '#16A34A', '#F59E0B', '#DC2626'][i] }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: ['#0B3D91', '#16A34A', '#F59E0B', '#DC2626'][i] }}>
                      {i}
                    </span>
                    <span className="font-semibold text-sm">{t('community')} #{i}</span>
                    <span className="text-xs text-nexus-text-secondary">({members.length} members)</span>
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
                        {a.severity}
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
