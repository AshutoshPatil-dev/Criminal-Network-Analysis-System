import { useApp } from '../store';
import type { TranslationKey } from '../i18n';

const navItems: { key: 'dashboard' | 'graph' | 'patterns' | 'report' | 'logs' | 'analysis' | 'fir' | 'officers'; icon: string; labelKey: TranslationKey }[] = [
  { key: 'dashboard', icon: '▦', labelKey: 'dashboard' },
  { key: 'graph', icon: '◈', labelKey: 'graph' },
  { key: 'report', icon: '⚑', labelKey: 'report' },
  { key: 'fir', icon: '✎', labelKey: 'firTitle' },
  { key: 'patterns', icon: '⚠', labelKey: 'patterns' },
  { key: 'analysis', icon: '✦', labelKey: 'aiAnalysis' },
  { key: 'officers', icon: '◫', labelKey: 'officersTitle' },
  { key: 'logs', icon: '≡', labelKey: 'logs' },
];

export default function Sidebar() {
  const { t, activeScreen, setActiveScreen, sidebarCollapsed, setSidebarCollapsed } = useApp();

  return (
    <aside
      className={`bg-white border-r border-nexus-border transition-all duration-200 flex flex-col ${sidebarCollapsed ? 'w-16' : 'w-56'}`}
      role="navigation"
      aria-label="Sidebar navigation"
    >
      <div className="p-2 border-b border-nexus-border flex justify-end">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded hover:bg-nexus-surface text-nexus-text-secondary"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>
      <ul className="flex-1 py-2" role="list">
        {navItems.map(item => {
          const active = activeScreen === item.key;
          return (
            <li key={item.key} role="none">
              <button
                role="menuitem"
                onClick={() => setActiveScreen(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition ${active
                  ? 'bg-nexus-blue/10 text-nexus-blue border-r-3 border-nexus-blue'
                  : 'text-nexus-text-secondary hover:bg-nexus-surface hover:text-nexus-text'
                }`}
                aria-current={active ? 'page' : undefined}
                title={sidebarCollapsed ? t(item.labelKey) : undefined}
              >
                <span className="text-lg flex-shrink-0" aria-hidden="true">{item.icon}</span>
                {!sidebarCollapsed && <span>{t(item.labelKey)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
