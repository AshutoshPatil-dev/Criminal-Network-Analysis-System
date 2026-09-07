import { useApp } from '../store';
import Login from './Login';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import NetworkGraph from './NetworkGraph';
import EntityProfile from './EntityProfile';
import PatternAnomaly from './PatternAnomaly';
import ReportEntry from './ReportEntry';
import AuditLogs from './AuditLogs';
import AiAnalysis from './AiAnalysis';
import FirReport from './FirReport';
import Officers from './Officers';

export default function Layout() {
  const { activeScreen, t, user, findingsToast, clearFindingsToast, setActiveScreen } = useApp();

  if (!user) return <Login />;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto" role="main">
          {activeScreen === 'dashboard' && <Dashboard />}
          {activeScreen === 'graph' && <NetworkGraph />}
          {activeScreen === 'profile' && <EntityProfile />}
          {activeScreen === 'patterns' && <PatternAnomaly />}
          {activeScreen === 'report' && <ReportEntry />}
          {activeScreen === 'logs' && <AuditLogs />}
          {activeScreen === 'analysis' && <AiAnalysis />}
          {activeScreen === 'fir' && <FirReport />}
          {activeScreen === 'officers' && <Officers />}
        </main>
      </div>

      {findingsToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-nexus-blue text-white rounded-xl shadow-lg px-4 py-3 max-w-sm flex items-start gap-3 border border-white/20" role="status" aria-live="polite">
          <span className="text-lg" aria-hidden="true">🔗</span>
          <div className="flex-1 text-sm">
            <p className="font-semibold">{t('linksFound', { count: findingsToast.count, subject: findingsToast.subject })}</p>
            <button onClick={() => { setActiveScreen('analysis'); clearFindingsToast(); }} className="mt-0.5 text-xs font-semibold text-white/85 underline underline-offset-2 hover:text-white">
              {t('viewInAI')}
            </button>
          </div>
          <button onClick={clearFindingsToast} className="text-white/60 hover:text-white text-xs shrink-0" aria-label={t('dismiss')}>✕</button>
        </div>
      )}
    </div>
  );
}