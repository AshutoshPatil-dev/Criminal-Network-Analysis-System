import { useApp, type Screen } from '../store';
import Dashboard from './Dashboard';
import NetworkGraph from './NetworkGraph';
import EntityProfile from './EntityProfile';
import PatternAnomaly from './PatternAnomaly';
import ReportEntry from './ReportEntry';
import FirReport from './FirReport';
import AiAnalysis from './AiAnalysis';
import Officers from './Officers';
import AuditLogs from './AuditLogs';
import Login from './Login';
import { LANGUAGES, type LangCode } from '../i18n';

export default function Layout() {
  const {
    activeScreen,
    setActiveScreen,
    user,
    signOut,
    searchQuery,
    setSearchQuery,
    searchResults,
    openProfile,
    lang,
    setLang,
    anomalies,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useApp();

  // If not logged in, render the login gate
  if (!user) {
    return <Login />;
  }

  // Official Police Nav Items with Crisp Vector SVGs (Zero Emojis)
  const navItems: { screen: Screen; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      screen: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      screen: 'graph',
      label: 'Network Graph',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="18" cy="5" r="3" strokeWidth={2} />
          <circle cx="6" cy="12" r="3" strokeWidth={2} />
          <circle cx="18" cy="19" r="3" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.59 13.51l6.83 3.98m-.01-10.98l-6.82 3.98" />
        </svg>
      ),
    },
    {
      screen: 'report',
      label: 'New Report',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      screen: 'fir',
      label: 'FIR Document',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      screen: 'patterns',
      label: 'Patterns & Anomalies',
      badge: anomalies.length,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      screen: 'analysis',
      label: 'AI Link Analysis',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      screen: 'officers',
      label: 'Officer Profiles',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      screen: 'logs',
      label: 'Audit Trail',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Header Bar (Executive Navy Blue #0B3D91) */}
      <header className="bg-[#0B3D91] text-white px-4 sm:px-6 py-2.5 flex items-center justify-between border-b border-blue-900 shadow-sm z-30">
        {/* Left: Close/Open Toggle Button + Emblem & App Title */}
        <div className="flex items-center gap-3">
          {/* Universal Sidebar Toggle Button (Desktop & Mobile) */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-blue-800 transition-colors cursor-pointer flex items-center justify-center"
            title={sidebarCollapsed ? "Expand Sidebar (Open)" : "Collapse Sidebar (Close)"}
            aria-label="Toggle Navigation Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {sidebarCollapsed ? (
                // Expand Icon (Bars + Right Arrow)
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16m-4-6l4 3m0-3l-4-3" />
              ) : (
                // Standard 3-Bars Menu Icon
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <div
            onClick={() => setActiveScreen('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            {/* Official Police Shield Emblem */}
            <div className="w-8 h-8 rounded-lg bg-blue-950 flex items-center justify-center border border-blue-400/30 text-blue-200 shadow-xs">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-wider uppercase">NEXUS</h1>
              <p className="text-[10px] text-blue-200 tracking-tight hidden sm:block">Criminal Network Analysis Dashboard</p>
            </div>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="relative max-w-md w-full mx-4 hidden lg:block">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search suspects, phones, vehicles, FIRs..."
              className="w-full bg-blue-950/70 border border-blue-400/30 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-blue-950 transition-all"
            />
            <svg className="w-4 h-4 text-blue-300 absolute left-3 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Live Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-10 left-0 right-0 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-2 z-50 max-h-72 overflow-y-auto">
              {searchResults.slice(0, 6).map(res => (
                <div
                  key={res.id}
                  onClick={() => {
                    openProfile(res.id);
                    setSearchQuery('');
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900">{res.name}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{res.type} · {res.attributes.role || 'Unspecified'}</div>
                  </div>
                  <span className="text-[10px] font-bold text-[#0B3D91] bg-blue-50 px-2 py-0.5 rounded-full">
                    Score {res.riskScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Tools & Officer Profile */}
        <div className="flex items-center gap-3">
          {/* Audit Logs Quick Button */}
          <button
            onClick={() => setActiveScreen('logs')}
            className="hidden sm:flex items-center gap-1.5 bg-blue-950/60 hover:bg-blue-800 border border-blue-400/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Audit Logs</span>
          </button>

          {/* Language Selector */}
          <select
            value={lang}
            onChange={e => setLang(e.target.value as LangCode)}
            className="bg-blue-950/60 hover:bg-blue-800 border border-blue-400/30 text-white rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} className="bg-slate-900 text-white">{l.name}</option>
            ))}
          </select>

          {/* Officer Identity Pill */}
          <div className="flex items-center gap-2 pl-2 border-l border-blue-800">
            <div className="w-7 h-7 rounded-full bg-blue-200 text-[#0B3D91] flex items-center justify-center font-bold text-xs">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left">
              <div className="font-bold text-xs leading-none">{user.name}</div>
              <div className="text-[10px] text-blue-200 leading-tight">{user.rank}</div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={signOut}
            className="bg-blue-800/60 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main App Layout (Sidebar + Screen Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsible Executive Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-60'
          } bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 overflow-hidden z-20 shrink-0 shadow-xs`}
        >
          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            {/* Direct Close/Open Action Bar at top of sidebar */}
            <div className={`flex items-center justify-between pb-2 mb-1 border-b border-slate-100 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  Navigation
                </span>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-md transition-colors cursor-pointer"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {sidebarCollapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  )}
                </svg>
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map(item => {
                const isActive = activeScreen === item.screen;
                return (
                  <button
                    key={item.screen}
                    onClick={() => setActiveScreen(item.screen)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0B3D91] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                      <span className={isActive ? 'text-white' : 'text-slate-500'}>
                        {item.icon}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="tracking-wide">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {/* Notification Badge if applicable */}
                    {item.badge !== undefined && item.badge > 0 && !sidebarCollapsed && (
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Dot Badge when Collapsed */}
                    {item.badge !== undefined && item.badge > 0 && sidebarCollapsed && (
                      <span className="absolute right-3 w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Officer Card & Quick Toggle Action */}
          <div className="p-3 border-t border-slate-200/80 bg-slate-50 flex flex-col gap-2">
            <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              {!sidebarCollapsed && (
                <div className="overflow-hidden">
                  <p className="text-[11px] font-bold text-slate-900 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.badgeNumber} · {user.district}</p>
                </div>
              )}
            </div>

            {/* Explicit Collapse Text Button */}
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="w-full text-center py-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
              >
                « Collapse Sidebar
              </button>
            )}
          </div>
        </aside>

        {/* Dynamic Screen View Content */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {activeScreen === 'dashboard' && <Dashboard />}
          {activeScreen === 'graph' && <NetworkGraph />}
          {activeScreen === 'profile' && <EntityProfile />}
          {activeScreen === 'patterns' && <PatternAnomaly />}
          {activeScreen === 'report' && <ReportEntry />}
          {activeScreen === 'fir' && <FirReport />}
          {activeScreen === 'analysis' && <AiAnalysis />}
          {activeScreen === 'officers' && <Officers />}
          {activeScreen === 'logs' && <AuditLogs />}
        </main>
      </div>
    </div>
  );
}