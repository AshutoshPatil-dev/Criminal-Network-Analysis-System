import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { Entity, AuditLogEntry, SubmittedReport, Officer, FirDocument } from './types';
import type { TranslationKey } from './i18n';
import { translations } from './i18n';
import { entities as allEntities, auditLogSeeds, officerSeeds } from './data/mockData';
import { persistAuditLog, persistReport, persistOfficer, deleteOfficerRow, persistFirDocument, signInWithPassword, signUpWithEmail, signOutSession } from './lib/supabase';

export type Screen = 'dashboard' | 'graph' | 'profile' | 'patterns' | 'report' | 'logs' | 'analysis' | 'fir' | 'officers';

const SCREENS: Screen[] = ['graph', 'profile', 'patterns', 'report', 'logs', 'analysis', 'fir', 'officers'];

const hashFor = (s: Screen, id?: string | null) => {
  if (s === 'dashboard') return '/';
  if (s === 'profile' && id) return `/profile/${id}`;
  return `/${s}`;
};

const parseHash = (): { screen: Screen; entityId: string | null } => {
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (!raw) return { screen: 'dashboard', entityId: null };
  const [root, id] = raw.split('/');
  if (SCREENS.includes(root as Screen)) return { screen: root as Screen, entityId: root === 'profile' ? id || null : null };
  return { screen: 'dashboard', entityId: null };
};

export const DEFAULT_OFFICER = 'Inspector R. Sharma';
const SESSION_KEY = 'nexus:session';

interface AppState {
  lang: 'en' | 'hi';
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  setLang: (l: 'en' | 'hi') => void;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  activeScreen: Screen;
  setActiveScreen: (s: Screen) => void;
  openProfile: (id: string) => void;
  goBack: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Entity[];
  expandedNodeIds: string[];
  setExpandedNodeIds: Dispatch<SetStateAction<string[]>>;
  dateRange: [string, string];
  setDateRange: Dispatch<SetStateAction<[string, string]>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  user: Officer | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (o: Omit<Officer, 'id' | 'createdAt'>, password: string) => Promise<string | null>;
  signInDemo: (officerId: string) => void;
  signOut: () => void;
  currentUser: string;
  officers: Officer[];
  addOfficer: (o: Omit<Officer, 'id' | 'createdAt'>) => string;
  updateOfficer: (id: string, patch: Partial<Omit<Officer, 'id' | 'createdAt'>>) => void;
  removeOfficer: (id: string) => void;
  firDocuments: FirDocument[];
  saveFirDocument: (d: Omit<FirDocument, 'id' | 'createdAt' | 'createdBy'> & { id?: string; createdAt?: string; createdBy?: string }) => string;
  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'actor'>) => string;
  submittedReports: SubmittedReport[];
  registerReport: (r: Omit<SubmittedReport, 'id' | 'submittedAt' | 'submittedBy'>) => string;
  findingsToast: { count: number; subject: string } | null;
  pushFindingsToast: (count: number, subject: string) => void;
  clearFindingsToast: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = parseHash();
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initial.entityId);
  const [activeScreen, setActiveScreen] = useState<Screen>(initial.screen);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>(['p1', 'p2', 'p5', 'p12', 'ph6', 'ph11']);
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-01-01', '2026-04-30']);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(auditLogSeeds);
  const [submittedReports, setSubmittedReports] = useState<SubmittedReport[]>([]);
  const [findingsToast, setFindingsToast] = useState<AppState['findingsToast']>(null);
  const [officers, setOfficers] = useState<Officer[]>(officerSeeds);
  const [firDocuments, setFirDocuments] = useState<FirDocument[]>([]);
  const [user, setUser] = useState<Officer | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved) as Officer;
      return officerSeeds.find(o => o.id === parsed.id) || parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash();
      setActiveScreen(parsed.screen);
      if (parsed.screen === 'profile') setSelectedEntityId(parsed.entityId);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str: string = translations[lang][key];
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      }
    }
    return str;
  };

  const searchResults = searchQuery.length > 0
    ? allEntities.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.values(e.attributes).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const navigate = (s: Screen) => {
    setActiveScreen(s);
    window.location.hash = hashFor(s);
  };

  const openProfile = (id: string) => {
    setSelectedEntityId(id);
    setActiveScreen('profile');
    window.location.hash = hashFor('profile', id);
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('dashboard');
    }
  };

  const actorName = () => user?.name || DEFAULT_OFFICER;

  const addAuditLog: AppState['addAuditLog'] = (entry) => {
    const id = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const full: AuditLogEntry = {
      ...entry,
      id,
      timestamp: new Date().toISOString(),
      actor: actorName(),
    };
    setAuditLogs(prev => [full, ...prev]);
    void persistAuditLog({ action: full.action, level: full.level, summary: full.summary, target: full.target });
    return id;
  };

  const applyUser = (o: Officer) => {
    setUser(o);
    localStorage.setItem(SESSION_KEY, JSON.stringify(o));
    addAuditLog({ action: 'login', level: 'info', summary: `${o.name} signed in (${o.district}, ${o.state}).`, target: o.badgeNumber });
  };

  const signIn: AppState['signIn'] = async (email, password) => {
    const officer = officers.find(o => o.email.toLowerCase() === email.trim().toLowerCase());
    const ok = await signInWithPassword(email.trim(), password);
    if (!ok && !officer) return 'Invalid email or password.';
    if (!ok && officer) {
      // Offline demo: accept any password for a registered officer profile
    }
    if (officer) {
      applyUser({ ...officer, updatedAt: new Date().toISOString() });
      return null;
    }
    // Email without an officer profile → create a transient profile
    const id = `off-${Date.now()}`;
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const demo: Officer = {
      id, name: name || 'Officer', badgeNumber: 'BR/TMP/0000', rank: 'Officer',
      district: '—', state: '—', email, phone: '—', role: 'case-officer',
      createdAt: new Date().toISOString(),
    };
    applyUser(demo);
    return null;
  };

  const signUp: AppState['signUp'] = async (o, password) => {
    const exists = officers.some(x => x.email.toLowerCase() === o.email.toLowerCase());
    if (exists) return 'An officer with this email already exists.';
    const ok = await signUpWithEmail(o.email, password);
    if (!ok) return 'Registration failed (remote auth unavailable).';
    addOfficer(o);
    signIn(o.email, password);
    return null;
  };

  const signInDemo = (officerId: string) => {
    const officer = officers.find(o => o.id === officerId) || officerSeeds.find(o => o.id === officerId);
    if (officer) applyUser(officer);
  };

  const signOut = () => {
    const name = actorName();
    addAuditLog({ action: 'logoff', level: 'info', summary: `${name} signed out.`, target: user?.badgeNumber });
    void signOutSession();
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const addOfficer: AppState['addOfficer'] = (o) => {
    const id = `off-${Date.now()}`;
    const full: Officer = { ...o, id, createdAt: new Date().toISOString() };
    setOfficers(prev => [full, ...prev]);
    void persistOfficer(full);
    addAuditLog({ action: 'create_officer', level: 'info', summary: `Added officer ${full.rank} ${full.name} (${full.district}, ${full.state}).`, target: full.badgeNumber });
    return id;
  };

  const updateOfficer: AppState['updateOfficer'] = (id, patch) => {
    setOfficers(prev => prev.map(o => o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o));
    const updated = { id, ...patch };
    void persistOfficer(updated as Officer);
    addAuditLog({ action: 'update_officer', level: 'info', summary: `Updated officer profile ${patch.name || id}.`, target: id });
    setUser(u => u && u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u);
  };

  const removeOfficer: AppState['removeOfficer'] = (id) => {
    if (user?.id === id) return;
    setOfficers(prev => prev.filter(o => o.id !== id));
    void deleteOfficerRow(id);
    addAuditLog({ action: 'delete_officer', level: 'warn', summary: `Removed officer profile ${id}.`, target: id });
  };

  const saveFirDocument: AppState['saveFirDocument'] = (d) => {
    const id = d.id || `fir-${Date.now()}`;
    const full: FirDocument = {
      ...d,
      id,
      createdAt: d.createdAt || new Date().toISOString(),
      createdBy: d.createdBy || actorName(),
    };
    setFirDocuments(prev => {
      const exists = prev.some(x => x.id === id);
      return exists ? prev.map(x => x.id === id ? full : x) : [full, ...prev];
    });
    void persistFirDocument({
      ref: full.ref,
      fir_number: full.firNumber,
      police_station: full.policeStation,
      district: full.district,
      state: full.state,
      incident_date: full.incidentDate,
      incident_time: full.incidentTime,
      sections_law: full.sectionsLaw,
      complainant_name: full.complainantName,
      complainant_age: full.complainantAge,
      complainant_father: full.complainantFather,
      complainant_address: full.complainantAddress,
      complainant_phone: full.complainantPhone,
      subject_name: full.subjectName,
      subject_aliases: full.subjectAliases,
      accused_details: full.accusedDetails,
      incident_location: full.incidentLocation,
      incident_description: full.incidentDescription,
      evidence_summary: full.evidenceSummary,
      io_name: full.ioName,
      io_rank: full.ioRank,
      report_ref: full.reportRef || null,
      ocr_source: full.ocrSource || null,
      attachments: full.attachments,
      created_by: full.createdBy,
    });
    addAuditLog({ action: 'save_fir', level: 'info', summary: `Saved FIR document ${full.ref} for ${full.subjectName || 'record'}.`, target: full.firNumber || full.ref });
    return id;
  };

  const registerReport: AppState['registerReport'] = (r) => {
    const id = `REPORT-2026-${String(submittedReports.length + 1).padStart(3, '0')}`;
    const full: SubmittedReport = { ...r, id, submittedAt: new Date().toISOString(), submittedBy: actorName() };
    setSubmittedReports(prev => [full, ...prev]);
    void persistReport({
      ref: id,
      fir_number: r.firNumber,
      subject_name: r.subjectName,
      incident_location: r.incidentLocation || null,
      details: r.details || [],
      submitted_by: actorName(),
    });
    return id;
  };

  const pushFindingsToast: AppState['pushFindingsToast'] = (count, subject) => {
    setFindingsToast({ count, subject });
    window.setTimeout(() => setFindingsToast(null), 10000);
  };

  return (
    <AppContext.Provider value={{
      lang, setLang, t,
      selectedEntityId, setSelectedEntityId,
      activeScreen, setActiveScreen: navigate,
      openProfile, goBack,
      searchQuery, setSearchQuery, searchResults,
      expandedNodeIds, setExpandedNodeIds,
      dateRange, setDateRange,
      sidebarCollapsed, setSidebarCollapsed,
      user, signIn, signUp, signInDemo, signOut,
      currentUser: actorName(),
      officers, addOfficer, updateOfficer, removeOfficer,
      firDocuments, saveFirDocument,
      auditLogs, addAuditLog,
      submittedReports, registerReport,
      findingsToast, pushFindingsToast, clearFindingsToast: () => setFindingsToast(null),
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}