import { useState } from 'react';
import { useApp } from '../store';
import { LANGUAGES } from '../i18n';

export default function Navbar() {
  const { t, lang, setLang, searchQuery, setSearchQuery, searchResults, openProfile, user, setActiveScreen, signOut, crimeEvents, firDocuments, selectFirDocument, openCrimeOnGraph } = useApp();
  const [langOpen, setLangOpen] = useState(false);
  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  const q = searchQuery.trim().toLowerCase();
  const firMatches = q.length > 0 ? crimeEvents.filter(c =>
    c.firNumber.toLowerCase().includes(q) ||
    (c.location ?? '').toLowerCase().includes(q)
  ).slice(0, 5) : [];
  const docMatches = q.length > 0 ? firDocuments.filter(d =>
    d.firNumber.toLowerCase().includes(q) ||
    d.ref.toLowerCase().includes(q) ||
    (d.subjectName ?? '').toLowerCase().includes(q) ||
    (d.incidentLocation ?? '').toLowerCase().includes(q)
  ).slice(0, 5) : [];
  const hasFirResults = firMatches.length > 0 || docMatches.length > 0;

  return (
    <nav className="bg-nexus-blue text-white shadow-lg sticky top-0 z-50" role="navigation" aria-label="Main navigation">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center font-bold text-lg" aria-hidden="true">N</div>
            <div>
              <span className="font-bold text-lg tracking-tight">{t('appName')}</span>
              <span className="hidden sm:inline text-blue-200 text-xs ml-2">{t('tagline')}</span>
            </div>
          </div>

          <div className="relative flex-1 max-w-md mx-6 hidden md:block">
            <label htmlFor="global-search" className="sr-only">{t('search')}</label>
            <input
              id="global-search"
              type="search"
              placeholder={t('search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-blue-200 focus:bg-white/20 focus:border-white/40 focus:outline-none transition"
            />
            {(searchResults.length > 0 || hasFirResults) && q.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-xl text-nexus-text max-h-96 overflow-y-auto z-50" role="listbox" aria-label="Search results">
                {searchResults.slice(0, 10).map(e => (
                  <li key={e.id}>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-nexus-surface flex items-center gap-2"
                      onClick={() => {
                        openProfile(e.id);
                        setSearchQuery('');
                      }}
                      role="option"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.type === 'person' ? '#0B3D91' : e.type === 'phone' ? '#7C3AED' : e.type === 'vehicle' ? '#DC2626' : e.type === 'location' ? '#16A34A' : '#F59E0B' }} aria-hidden="true" />
                      <span className="font-medium">{e.name}</span>
                      <span className="text-nexus-text-secondary text-xs ml-auto capitalize">{e.type}</span>
                    </button>
                  </li>
                ))}
                {docMatches.map(d => (
                  <li key={`doc-${d.ref}`}>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-nexus-surface flex items-center gap-2"
                      onClick={() => {
                        selectFirDocument(d.ref);
                        setSearchQuery('');
                      }}
                      role="option"
                    >
                      <span className="text-nexus-risk-high font-bold" aria-hidden="true">📄</span>
                      <span className="font-medium">{d.firNumber || d.ref}</span>
                      <span className="text-nexus-text-secondary text-xs ml-auto capitalize">FIR · {d.subjectName || d.policeStation || d.ref}</span>
                    </button>
                  </li>
                ))}
                {firMatches.map(c => (
                  <li key={`crime-${c.id}`}>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-nexus-surface flex items-center gap-2"
                      onClick={() => {
                        openCrimeOnGraph(c.id);
                        setSearchQuery('');
                      }}
                      role="option"
                    >
                      <span className="text-nexus-risk-high font-bold" aria-hidden="true">⚠</span>
                      <span className="font-mono font-medium">{c.firNumber}</span>
                      <span className="text-nexus-text-secondary text-xs ml-auto capitalize">{c.location} · {c.date}</span>
                    </button>
                  </li>
                ))}
                {searchResults.length === 0 && !hasFirResults && (
                  <li className="px-4 py-2 text-sm text-nexus-text-secondary" role="option">No matches</li>
                )}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('logs')}
              className="px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-md transition flex items-center gap-1.5"
              aria-label={t('logs')}
              title={t('logs')}
            >
              <span aria-hidden="true">≡</span>
              <span className="hidden sm:inline">{t('logs')}</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setLangOpen(o => !o)}
                className="px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-md transition flex items-center gap-1.5"
                aria-label={t('language')}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
              >
                <span aria-hidden="true">🌐</span>
                <span>{current.name}</span>
                <span aria-hidden="true" className="text-[10px]">
                  {langOpen ? '▲' : '▼'}
                </span>
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setLangOpen(false)} />
                  <ul
                    role="listbox"
                    className="absolute right-0 z-40 mt-1.5 min-w-[160px] rounded-md bg-white border border-nexus-border shadow-lg overflow-hidden"
                  >
                    {LANGUAGES.map(l => (
                      <li key={l.code}>
                        <button
                          role="option"
                          aria-selected={l.code === lang}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-nexus-surface transition ${
                            l.code === lang ? 'font-semibold text-nexus-blue' : 'text-nexus-text'
                          }`}
                        >
                          {l.code === lang && <span aria-hidden="true">✓</span>}
                          <span className={l.code === lang ? '' : 'pl-[18px]'}>{l.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div
              className="flex items-center gap-2 bg-white/10 rounded-full pl-1 pr-3 py-1"
              title={user ? `${user.name} · ${user.rank} · ${user.district}, ${user.state}` : ''}
              aria-label={`User profile: ${user?.name}`}
            >
              <div className="w-7 h-7 bg-white/25 rounded-full flex items-center justify-center text-xs font-bold" aria-hidden="true">
                {user?.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div className="leading-tight">
                <span className="text-xs font-medium hidden md:inline">{user?.name.split(' ').slice(-2).join(' ')}</span>
                {user && <span className="block text-[10px] text-blue-200 hidden lg:block">{user.rank} · {user.district}</span>}
              </div>
            </div>
            <button
              onClick={signOut}
              className="px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-red-500/80 rounded-md transition"
              title={t('signOut')}
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}