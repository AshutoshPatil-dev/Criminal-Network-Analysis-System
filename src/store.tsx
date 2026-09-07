import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import type { Entity, AuditLogEntry, SubmittedReport, Officer, FirDocument, Relationship, CrimeEvent, CentralityScore, Community, Anomaly } from './types';
import type { TranslationKey, LangCode } from './i18n';
import { translations } from './i18n';
import { deriveGraph } from './lib/graph';
import { persistAuditLog, persistReport, updateOfficerRow, deleteOfficerRow, persistFirDocument, createOfficerAccount, fetchProfiles, fetchMyProfile, signInWithPassword, signOutSession, getSessionUser, supabaseConfigured, fetchEntities, fetchRelationships, fetchCrimeEvents, fetchAuditLogs, fetchReports, fetchFirDocuments } from './lib/supabase';

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

export const DEFAULT_OFFICER = 'System';
const SESSION_KEY = 'nexus:session';

interface AppState {
  lang: LangCode;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  setLang: (l: LangCode) => void;
  selectedEntityId: string | null;
  setSelectedEntityId: (id: string | null) => void;
  activeScreen: Screen;
  setActiveScreen: (s: Screen) => void;
  openProfile: (id: string) => void;
  goBack: () => void;
  selectedFirRef: string | null;
  setSelectedFirRef: (ref: string | null) => void;
  selectFirDocument: (ref: string) => void;
  openCrimeOnGraph: (crimeId: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: Entity[];
  expandedNodeIds: string[];
  setExpandedNodeIds: Dispatch<SetStateAction<string[]>>;
  dateRange: [string, string];
  setDateRange: Dispatch<SetStateAction<[string, string]>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
  entities: Entity[];
  relationships: Relationship[];
  crimeEvents: CrimeEvent[];
  centralityScores: CentralityScore[];
  communities: Community[];
  anomalies: Anomaly[];
  user: Officer | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  currentUser: string;
  officers: Officer[];
  refreshOfficers: () => Promise<void>;
  addOfficer: (o: Omit<Officer, 'id' | 'createdAt'>, password: string) => Promise<string | null>;
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
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('nexus_lang');
    return saved && saved in translations ? saved as LangCode : 'en';
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(initial.entityId);
  const [selectedFirRef, setSelectedFirRef] = useState<string | null>(null);
  const [activeScreen, setActiveScreen] = useState<Screen>(initial.screen);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[string, string]>(['2000-01-01', '2099-12-31']);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [crimeEvents, setCrimeEvents] = useState<CrimeEvent[]>([]);
  const [submittedReports, setSubmittedReports] = useState<SubmittedReport[]>([]);
  const [findingsToast, setFindingsToast] = useState<AppState['findingsToast']>(null);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [firDocuments, setFirDocuments] = useState<FirDocument[]>([]);
  const [user, setUser] = useState<Officer | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as Officer;
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
    let str: string = (translations[lang] as Record<string, string | undefined>)[key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const k of Object.keys(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]));
      }
    }
    return str;
  };

  const changeLang = (next: LangCode) => {
    setLang(next);
    try { localStorage.setItem('nexus_lang', next); } catch { /* ignore */ }
  };

  const searchResults = searchQuery.length > 0
    ? entities.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Object.values(e.attributes).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const derived = useMemo(() => deriveGraph({ entities, relationships, crimeEvents }), [entities, relationships, crimeEvents]);

  const navigate = (s: Screen) => {
    setActiveScreen(s);
    window.location.hash = hashFor(s);
  };

  const openProfile = (id: string) => {
    setSelectedEntityId(id);
    setActiveScreen('profile');
    window.location.hash = hashFor('profile', id);
  };

  // Global FIR search → open the saved FIR document in the FIR screen.
  const selectFirDocument: AppState['selectFirDocument'] = (ref) => {
    setSelectedFirRef(ref);
    navigate('fir');
  };

  // Global FIR search → jump to the network graph timeline around that crime.
  const openCrimeOnGraph: AppState['openCrimeOnGraph'] = (crimeId) => {
    const ce = crimeEvents.find(c => c.id === crimeId);
    if (ce) {
      const d = new Date(`${ce.date}T00:00:00`);
      const start = new Date(d.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      setDateRange([start, ce.date]);
    }
    navigate('graph');
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
    const id = `log-${crypto.randomUUID()}`;
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

  const persistSession = (o: Officer, recordLogin: boolean) => {
    setUser(o);
    localStorage.setItem(SESSION_KEY, JSON.stringify(o));
    if (recordLogin) {
      addAuditLog({ action: 'login', level: 'info', summary: `${o.name} signed in (${o.district}, ${o.state}).`, target: o.badgeNumber });
    }
  };

  const applyUser = (o: Officer) => persistSession(o, true);

  // When a real Supabase project is connected, reconcile the app session with
  // the (server-validated) Supabase session on boot and load the roster from
  // profiles. A forged local session object is rejected. Without a configured
  // project there is no sign-in: the roster lives entirely in Supabase now.
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const su = await getSessionUser();
      if (cancelled) return;
      if (!su) {
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      const profile = await fetchMyProfile();
      if (cancelled) return;
      if (!profile) {
        // Valid auth session but no officer profile → not an officer.
        setUser(null);
        localStorage.removeItem(SESSION_KEY);
        return;
      }
      setUser({ ...profile, updatedAt: new Date().toISOString() });
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...profile, updatedAt: new Date().toISOString() }));
      const rows = await fetchProfiles();
      if (!cancelled && rows.length) setOfficers(rows);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured]);

  // Load the case graph and persisted history from Supabase. Re-fetches after
  // sign-in flips the session so authenticated-role RLS policies apply.
  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const [ent, rel, evs, logs, reports, firs] = await Promise.all([
        fetchEntities(),
        fetchRelationships(),
        fetchCrimeEvents(),
        fetchAuditLogs(),
        fetchReports(),
        fetchFirDocuments(),
      ]);
      if (cancelled) return;
      if (ent.length) {
        setEntities(ent);
        // Network graph starts focused on the highest-risk core so the canvas
        // is not cluttered; "Expand All" reveals the full network.
        const focus = [...ent].sort((a, b) => b.riskScore - a.riskScore).slice(0, 12);
        setExpandedNodeIds(focus.map(e => e.id));
      }
      if (rel.length) setRelationships(rel);
      if (evs.length) setCrimeEvents(evs);
      if (logs.length) setAuditLogs(logs);
      if (reports.length) setSubmittedReports(reports);
      if (firs.length) setFirDocuments(firs);
      // Point the timeline at the loaded data span instead of the placeholder
      // 2000–2099 range, so the date inputs show meaningful values.
      const stamps = [...rel.flatMap(r => r.timestamps ?? []), ...evs.map(e => e.date)]
        .map(s => new Date(s).getTime())
        .filter(n => !Number.isNaN(n));
      if (stamps.length > 0) {
        const lo = new Date(Math.min(...stamps)).toISOString().slice(0, 10);
        const hi = new Date(Math.max(...stamps)).toISOString().slice(0, 10);
        setDateRange([lo, hi]);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseConfigured, user]);

  const signIn: AppState['signIn'] = async (email, password) => {
    if (!supabaseConfigured) return 'Supabase is not configured — check your .env and redeploy.';
    const ok = await signInWithPassword(email.trim(), password);
    if (!ok) return 'Invalid email or password.';
    // The officer must exist in profiles (admin-managed).
    const profile = await fetchMyProfile();
    if (!profile) return 'No officer profile found for this account. Contact an administrator.';
    applyUser({ ...profile, updatedAt: new Date().toISOString() });
    return null;
  };

  const signOut = () => {
    const name = actorName();
    addAuditLog({ action: 'logoff', level: 'info', summary: `${name} signed out.`, target: user?.badgeNumber });
    void signOutSession();
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const refreshOfficers: AppState['refreshOfficers'] = async () => {
    if (!supabaseConfigured) return;
    const rows = await fetchProfiles();
    if (rows.length > 0) setOfficers(rows);
  };

  const addOfficer: AppState['addOfficer'] = async (o, password) => {
    if (!supabaseConfigured) return 'Supabase is not configured — check your .env and redeploy.';
    if (user?.role !== 'admin') return 'Only an admin can add officers.';
    const res = await createOfficerAccount(o, password);
    if (!res.ok) return res.error || 'Could not create officer account.';
    const full: Officer = { ...o, id: res.id || `off-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    setOfficers(prev => [full, ...prev]);
    addAuditLog({ action: 'create_officer', level: 'info', summary: `Added officer ${full.rank} ${full.name} (${full.district}, ${full.state}).`, target: full.badgeNumber });
    return null;
  };

  const updateOfficer: AppState['updateOfficer'] = (id, patch) => {
    setOfficers(prev => prev.map(o => o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o));
    void updateOfficerRow(id, patch);
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
    const id = d.id || `fir-${crypto.randomUUID()}`;
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
      lang, setLang: changeLang, t,
      selectedEntityId, setSelectedEntityId,
      activeScreen, setActiveScreen: navigate,
      openProfile, goBack,
      selectedFirRef, setSelectedFirRef, selectFirDocument, openCrimeOnGraph,
      searchQuery, setSearchQuery, searchResults,
      expandedNodeIds, setExpandedNodeIds,
      dateRange, setDateRange,
      sidebarCollapsed, setSidebarCollapsed,
      entities, relationships, crimeEvents,
      centralityScores: derived.centralityScores,
      communities: derived.communities,
      anomalies: derived.anomalies,
      user, signIn, signOut,
      currentUser: actorName(),
      officers, refreshOfficers, addOfficer, updateOfficer, removeOfficer,
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