import { useMemo } from 'react';
import { useApp } from '../store';
import type { Entity } from '../types';

export default function Dashboard() {
  const {
    entities,
    relationships,
    crimeEvents,
    anomalies,
    submittedReports,
    firDocuments,
    openProfile,
    setSelectedEntityId,
    setActiveScreen,
    openCrimeOnGraph,
    user,
  } = useApp();

  // Sort top high-threat suspects (Kingpins / Most Wanted)
  const topSuspects = useMemo(() => {
    return entities
      .filter(e => e.type === 'person')
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 4);
  }, [entities]);

  // Count active burner phones
  const burnerPhoneCount = useMemo(() => {
    const fromAnomalies = anomalies.filter(a => a.type === 'burner_phone').length;
    const fromEntities = entities.filter(
      e => e.type === 'phone' && (e.attributes.role?.toLowerCase().includes('burner') || e.riskScore >= 60)
    ).length;
    return Math.max(fromAnomalies, fromEntities);
  }, [anomalies, entities]);

  // Count high risk suspects (>70)
  const highRiskCount = useMemo(() => {
    return entities.filter(e => e.type === 'person' && e.riskScore >= 70).length;
  }, [entities]);

  const handleTraceOnGraph = (entityId: string) => {
    setSelectedEntityId(entityId);
    setActiveScreen('graph');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] font-sans p-4 sm:p-6 space-y-6">
      {/* 1. Official Operational Status Banner */}
      <header className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#0B3D91]">
              MHA · NCRB Central Criminal Intelligence Grid
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-slate-500">Security Level: Restricted Law Enforcement</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Operational Intelligence Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time link analysis across FIRs, telecom call detail records (CDRs), and organized syndicates.
          </p>
        </div>

        {/* Current Officer Status Pill */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 flex items-center gap-3 self-stretch md:self-auto">
          <div className="w-8 h-8 rounded-lg bg-[#0B3D91] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {user?.badgeNumber.slice(0, 3) || 'IO'}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800">{user?.name || 'Chief Investigator'}</div>
            <div className="text-[10px] text-slate-500">{user?.rank || 'Superintendent of Police'} · {user?.district || 'Central Command'}</div>
          </div>
        </div>
      </header>

      {/* 2. Executive KPI Cards (Tactical White Cards with Navy Accents) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Monitored Suspects */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tracked Suspects</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {entities.filter(e => e.type === 'person').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0B3D91] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Critical Threat:</span>
            <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{highRiskCount} High Risk</span>
          </div>
        </div>

        {/* KPI 2: Active Burner SIMs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Burner Phone SIMs</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {burnerPhoneCount}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Surveillance:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pre-Crime Spike</span>
          </div>
        </div>

        {/* KPI 3: Connected FIR Cases */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Connected FIRs</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {crimeEvents.length + firDocuments.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Jurisdictions:</span>
            <span className="font-bold text-slate-700">Multi-District Link</span>
          </div>
        </div>

        {/* KPI 4: Network Interconnections */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Evidence Links</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {relationships.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Integrity Audit:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">SHA-256 Verified</span>
          </div>
        </div>
      </section>

      {/* 3. Fast Operational Shortcuts Bar */}
      <section className="bg-gradient-to-r from-[#0B3D91] to-[#1A52B8] rounded-2xl p-4 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <svg className="w-5 h-5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-sm text-white">Investigation Launchpad</h4>
            <p className="text-xs text-blue-100">Directly jump into network link analysis, scanned FIR intake, or AI audit.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveScreen('graph')}
            className="bg-white text-[#0B3D91] hover:bg-blue-50 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Launch Network Graph
          </button>
          <button
            onClick={() => setActiveScreen('fir')}
            className="bg-blue-950/60 hover:bg-blue-950/80 border border-blue-300/30 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            File Scanned FIR (OCR)
          </button>
          <button
            onClick={() => setActiveScreen('report')}
            className="bg-blue-950/60 hover:bg-blue-950/80 border border-blue-300/30 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            New Evidence Report
          </button>
        </div>
      </section>

      {/* 4. Two-Column Intelligence Grid: Target Watchlist & Live Anomaly Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): High-Priority Target Watchlist */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">High-Threat Target Watchlist</h3>
              <p className="text-xs text-slate-500">Suspects with highest centrality, network influence, and crime involvement.</p>
            </div>
            <span className="text-[11px] font-bold text-[#0B3D91] bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Top Priority
            </span>
          </div>

          <div className="space-y-3">
            {topSuspects.map((suspect: Entity) => {
              const riskColor =
                suspect.riskScore >= 75 ? 'text-red-600 bg-red-50 border-red-200' :
                suspect.riskScore >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' :
                'text-emerald-600 bg-emerald-50 border-emerald-200';

              const progressColor =
                suspect.riskScore >= 75 ? 'bg-red-600' :
                suspect.riskScore >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <div
                  key={suspect.id}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 hover:bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0B3D91] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {suspect.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{suspect.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskColor}`}>
                          Score {suspect.riskScore}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {suspect.attributes.role || 'Conspirator'} · {suspect.attributes.phone || 'No direct SIM'}
                      </p>
                    </div>
                  </div>

                  {/* Threat Meter & Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <div className="hidden md:block w-20 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progressColor}`}
                        style={{ width: `${suspect.riskScore}%` }}
                      />
                    </div>
                    <button
                      onClick={() => handleTraceOnGraph(suspect.id)}
                      className="bg-white border border-slate-300 hover:border-blue-500 hover:text-[#0B3D91] text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      Trace Link
                    </button>
                    <button
                      onClick={() => openProfile(suspect.id)}
                      className="bg-[#0B3D91] hover:bg-[#1A52B8] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      Dossier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column (5 cols): Live Anomaly Threat Stream */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900">Pattern & Anomaly Radar</h3>
              <p className="text-xs text-slate-500">Algorithmic alerts detected across timeline and communications.</p>
            </div>
            <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              {anomalies.length} Flagged
            </span>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {anomalies.map(anomaly => (
              <div
                key={anomaly.id}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white transition-all space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {anomaly.type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      anomaly.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {anomaly.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {anomaly.description}
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Involved: {anomaly.entityIds.slice(0, 3).join(', ')}</span>
                  <button
                    onClick={() => setActiveScreen('patterns')}
                    className="text-[#0B3D91] hover:underline font-semibold cursor-pointer"
                  >
                    View Alert
                  </button>
                </div>
              </div>
            ))}

            {anomalies.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No active integrity alerts detected.</p>
            )}
          </div>
        </section>
      </div>

      {/* 5. Registered Crime Events & Active Cases Table */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900">Active Recorded Crime Events (FIR Repository)</h3>
            <p className="text-xs text-slate-500">Jurisdictional incidents cross-referenced with network entities.</p>
          </div>
          <button
            onClick={() => setActiveScreen('fir')}
            className="text-xs font-bold text-[#0B3D91] hover:underline cursor-pointer"
          >
            Open FIR Manager →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">FIR Reference</th>
                <th className="py-2.5 px-3">Incident Date</th>
                <th className="py-2.5 px-3">Jurisdiction Location</th>
                <th className="py-2.5 px-3">Conspirators Linked</th>
                <th className="py-2.5 px-3 text-right">Investigation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {crimeEvents.slice(0, 5).map(ce => (
                <tr key={ce.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{ce.firNumber}</td>
                  <td className="py-3 px-3 text-slate-500">{ce.date}</td>
                  <td className="py-3 px-3 font-medium text-slate-800">{ce.location}</td>
                  <td className="py-3 px-3">
                    <span className="bg-blue-50 text-[#0B3D91] font-semibold px-2 py-0.5 rounded-md border border-blue-100">
                      {ce.involvedEntityIds.length} Suspects
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => openCrimeOnGraph(ce.id)}
                      className="bg-white border border-slate-300 hover:border-blue-500 hover:text-[#0B3D91] text-slate-700 font-semibold px-3 py-1 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
                    >
                      Focus on Graph
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}