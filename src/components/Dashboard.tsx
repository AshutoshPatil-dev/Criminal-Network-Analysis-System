import { useApp } from '../store';
import { riskColor } from '../utils/theme';

export default function Dashboard() {
  const { t, setActiveScreen, openProfile, entities, relationships, crimeEvents, centralityScores, anomalies } = useApp();

  const totalEntities = entities.length;
  const totalRelationships = relationships.length;

  const topInfluencers = [...centralityScores]
    .sort((a, b) => b.pageRank - a.pageRank)
    .slice(0, 6)
    .map(cs => {
      const e = entities.find(e => e.id === cs.entityId && e.type === 'person');
      if (!e) return null;
      return { ...e, pageRank: cs.pageRank, degree: cs.degree };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const topFlags = anomalies
    .slice()
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]))
    .slice(0, 3)
    .map(a => ({ icon: a.type === 'burner_phone' ? '🔥' : a.type === 'bridge_node' ? '🌉' : a.type === 'unusual_pattern' ? '📊' : '⚠', text: a.description, sev: a.severity }));

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-nexus-text">{t('dashboard')}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label={t('caseSummary')}>
        {[
          { label: t('totalEntities'), value: totalEntities, color: 'text-nexus-blue' },
          { label: t('activeCases'), value: crimeEvents.length, color: 'text-nexus-risk-high' },
          { label: t('connections'), value: totalRelationships, color: 'text-nexus-text-secondary' },
          { label: t('anomalies'), value: anomalies.length, color: 'text-nexus-risk-medium' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border border-nexus-border p-5 hover:shadow-md transition">
            <p className="text-sm text-nexus-text-secondary font-medium">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Persons of Interest */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-nexus-border">
          <div className="px-5 py-4 border-b border-nexus-border flex items-center justify-between">
            <h2 className="font-semibold text-lg">{t('personsOfInterest')}</h2>
            <button
              onClick={() => setActiveScreen('graph')}
              className="text-sm text-nexus-blue hover:underline"
            >
              {t('viewAll')}
            </button>
          </div>
          <div className="divide-y divide-nexus-border">
            {topInfluencers.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-nexus-text-secondary">{t('noData')}</div>
            )}
            {topInfluencers.map((person, i) => (
              <button
                key={person.id}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-nexus-surface transition text-left"
                onClick={() => { openProfile(person.id); }}
              >
                <span className="w-8 h-8 rounded-full bg-nexus-blue/10 text-nexus-blue flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{person.name}</p>
                  <p className="text-xs text-nexus-text-secondary">{person.attributes.role} — {person.attributes.address}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-2 bg-nexus-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${person.pageRank * 500}%`, backgroundColor: riskColor(person.riskScore) }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8">{(person.pageRank * 100).toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-nexus-text-secondary mt-0.5">Rank: {(person.degree * 100).toFixed(0)}%</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right column: recent events + quick links */}
        <div className="space-y-6">
          {/* Crime Events */}
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
            <div className="px-5 py-4 border-b border-nexus-border">
              <h2 className="font-semibold text-lg">{t('linkedFIRs')}</h2>
            </div>
            <div className="divide-y divide-nexus-border">
            {crimeEvents.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-nexus-text-secondary">{t('noData')}</div>
            )}
            {crimeEvents.map(fir => (
                <div key={fir.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-nexus-blue">{fir.firNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-nexus-risk-high font-medium">
                      {fir.involvedEntityIds.length} involved
                    </span>
                  </div>
                  <p className="text-xs text-nexus-text-secondary mt-1">{fir.location} — {fir.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Flagged Patterns */}
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border">
            <div className="px-5 py-4 border-b border-nexus-border">
              <h2 className="font-semibold text-lg">{t('recentFlagged')}</h2>
            </div>
            <div className="p-4 space-y-3">
            {topFlags.length === 0 && (
              <p className="text-sm text-nexus-text-secondary">{t('noData')}</p>
            )}
            {topFlags.map((flag, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${flag.sev === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <span aria-hidden="true">{flag.icon}</span>
                  <p className={`text-xs leading-relaxed ${flag.sev === 'high' ? 'text-nexus-risk-high' : 'text-nexus-risk-medium'}`}>{flag.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Entity type breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
            <h2 className="font-semibold text-lg mb-3">{t('filterByType')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['persons', '#0B3D91', entities.filter(e => e.type === 'person').length],
                ['phones', '#7C3AED', entities.filter(e => e.type === 'phone').length],
                ['vehicles', '#DC2626', entities.filter(e => e.type === 'vehicle').length],
                ['locations', '#16A34A', entities.filter(e => e.type === 'location').length],
                ['organizations', '#F59E0B', entities.filter(e => e.type === 'org').length],
              ] as const).map(([label, color, count]) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="text-nexus-text-secondary">{t(label)}</span>
                  <span className="font-semibold ml-auto">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
