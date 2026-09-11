import { useApp } from '../store';
import { entityTypeColors, riskColor, riskLabelKey } from '../utils/theme';
import { entityTypeLabel, relationshipTypeLabel, type TranslationKey } from '../i18n';

export default function EntityProfile() {
  const { t, selectedEntityId, openProfile, goBack, entities, relationships, crimeEvents, centralityScores } = useApp();

  const entity = selectedEntityId ? entities.find(e => e.id === selectedEntityId) : null;

  if (!entity) {
    return (
      <div className="p-6 max-w-screen-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-12 text-center">
          <p className="text-nexus-text-secondary text-lg mb-4">{t('noData')}</p>
          <p className="text-sm text-nexus-text-secondary mb-6">{t('profileHint')}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {entities.filter(e => e.type === 'person').slice(0, 8).map(p => (
              <button
                key={p.id}
                onClick={() => openProfile(p.id)}
                className="px-3 py-1.5 text-sm border border-nexus-border rounded-lg hover:bg-nexus-surface transition"
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const linkedRels = relationships.filter(r => r.source === entity.id || r.target === entity.id);
  const linkedEntities = linkedRels.map(r => {
    const otherId = r.source === entity.id ? r.target : r.source;
    const other = entities.find(e => e.id === otherId);
    return { ...r, otherEntity: other };
  }).filter(r => r.otherEntity);

  const linkedCrimes = crimeEvents.filter(ce => ce.involvedEntityIds.includes(entity.id));
  const aliases = entity.attributes.aliases ? entity.attributes.aliases.split(',').map(a => a.trim()).filter(Boolean) : [];

  const centrality = centralityScores.find(c => c.entityId === entity.id);

  const ATTRIBUTE_KEYS: Record<string, TranslationKey> = {
    role: 'role',
    address: 'address',
    aliases: 'aliases',
    owner: 'owner',
    vehicleRegistration: 'vehicleNumber',
    phone: 'detailPhone',
    employers: 'detailEmployer',
    bankAccounts: 'detailBank',
  };
  const attrLabel = (k: string): string => ATTRIBUTE_KEYS[k] ? t(ATTRIBUTE_KEYS[k]) : k.charAt(0).toUpperCase() + k.slice(1);

  // Timeline events
  const timelineEvents = linkedRels.flatMap(r =>
    r.timestamps.map(ts => ({
      date: ts,
      type: r.type,
      other: r.source === entity.id ? r.target : r.source,
      otherName: entities.find(e => e.id === (r.source === entity.id ? r.target : r.source))?.name || t('unknown'),
    }))
  ).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={goBack} className="text-nexus-blue hover:underline text-sm">&larr; {t('back')}</button>
        <h1 className="text-2xl font-bold text-nexus-text">{t('profile')}</h1>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-6 flex items-start gap-6">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
          style={{ backgroundColor: entityTypeColors[entity.type] }}
          aria-hidden="true"
        >
          {entity.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">{entity.name}</h2>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: riskColor(entity.riskScore) }}
            >
              {t(riskLabelKey(entity.riskScore))} ({entity.riskScore})
            </span>
          </div>
          <p className="text-sm text-nexus-text-secondary mt-1">{entityTypeLabel(t, entity.type)} — {t('idLabel')}: {entity.id}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm">
            {Object.entries(entity.attributes).map(([k, v]) => {
              if (!v) return null;
              return (
                <div key={k}>
                  <span className="text-nexus-text-secondary">{attrLabel(k)}:</span>{' '}
                  <span className="font-medium">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="space-y-6">
          {/* Network influence (plain-English measures) */}
          {centrality && (
            <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
              <h3 className="font-semibold mb-1">{t('networkInfluence')}</h3>
              <p className="text-xs text-nexus-text-secondary mb-4">{t('networkInfluenceHint')}</p>
              <div className="space-y-4">
                {[
                  { key: 'directConnections', pct: centrality.degree, desc: 'directConnectionsDesc' },
                  { key: 'goBetween', pct: centrality.betweenness, desc: 'goBetweenDesc' },
                  { key: 'keyPlayerLinks', pct: centrality.eigenvector, desc: 'keyPlayerLinksDesc' },
                  { key: 'overallInfluence', pct: centrality.pageRank, desc: 'overallInfluenceDesc' },
                ].map(m => {
                  const pct = Math.min(100, Math.max(0, m.pct * 100));
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium">{t(m.key as TranslationKey)}</span>
                        <span className="text-sm font-semibold text-nexus-text-secondary">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-nexus-surface overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: riskColor(entity.riskScore) }}
                        />
                      </div>
                      <p className="text-xs text-nexus-text-secondary mt-1.5">{t(m.desc as TranslationKey)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aliases */}
          {aliases.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
              <h3 className="font-semibold mb-2">{t('aliases')}</h3>
              <div className="flex flex-wrap gap-2">
                {aliases.map(a => (
                  <span key={a} className="px-2.5 py-1 bg-nexus-surface rounded-md text-sm font-medium">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Linked FIRs */}
          {linkedCrimes.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
              <h3 className="font-semibold mb-3">{t('linkedFIRs')}</h3>
              <div className="space-y-2">
                {linkedCrimes.map(cr => (
                  <div key={cr.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="font-mono font-bold text-nexus-risk-high text-sm">{cr.firNumber}</p>
                    <p className="text-xs text-nexus-text-secondary mt-1">{cr.location} — {cr.date}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: Timeline */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
            <h3 className="font-semibold mb-4">{t('timelineActivity')}</h3>
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-nexus-border" aria-hidden="true" />
              {timelineEvents.slice(-20).reverse().map((evt, i) => (
                <div key={i} className="relative mb-4">
                  <div className="absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: evt.type === 'call' ? '#64748B' : evt.type === 'meeting' ? '#0B3D91' : evt.type === 'transaction' ? '#16A34A' : '#F59E0B' }} aria-hidden="true" />
                  <p className="text-xs font-medium">{evt.date}</p>
                  <p className="text-xs text-nexus-text-secondary">{relationshipTypeLabel(t, evt.type)} — {evt.otherName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Associated Nodes */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-nexus-border p-5">
            <h3 className="font-semibold mb-3">{t('associatedNodes')} ({linkedEntities.length})</h3>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {linkedEntities
                .sort((a, b) => (b.otherEntity?.riskScore || 0) - (a.otherEntity?.riskScore || 0))
                .map((rel, i) => {
                  const other = rel.otherEntity!;
                  return (
                    <button
                      key={`${rel.source}-${rel.target}-${i}`}
                      onClick={() => { openProfile(other.id); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-nexus-surface transition text-left"
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: entityTypeColors[other.type] }}
                        aria-hidden="true"
                      >
                        {other.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{other.name}</p>
                        <p className="text-xs text-nexus-text-secondary">{relationshipTypeLabel(t, rel.type)} ({rel.count}x)</p>
                      </div>
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: riskColor(other.riskScore) }}
                        aria-label={`Risk: ${other.riskScore}`}
                      />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
