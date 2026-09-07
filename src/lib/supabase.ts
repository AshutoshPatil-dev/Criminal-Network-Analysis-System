import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Officer, Entity, Relationship, CrimeEvent, AuditLogEntry, SubmittedReport, ReportDetail, FirDocument, FirAttachment } from '../types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  supabaseConfigured && url && anonKey ? createClient(url, anonKey) : null;

export interface CdrPayload {
  path: string;
  storagePath: string;
}

export const uploadCdrFile = async (bucket: string, file: File): Promise<CdrPayload | null> => {
  if (!supabase) return null;
  const storagePath = `cdr/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  return { path: `${bucket}/${storagePath}`, storagePath };
};

export const persistAuditLog = async (input: {
  action: string;
  level: string;
  summary: string;
  target?: string;
}): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('audit_logs').insert({
      action: input.action,
      level: input.level,
      summary: input.summary,
      target: input.target ?? null,
    });
  } catch {
    // offline / policy-denied → keep in-memory log as source of truth
  }
};

export const persistReport = async (input: {
  ref: string;
  fir_number: string;
  subject_name: string;
  incident_location: string | null;
  details: unknown[];
  submitted_by: string;
}): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('reports').insert({
      ref: input.ref,
      fir_number: input.fir_number,
      subject_name: input.subject_name,
      incident_location: input.incident_location,
      details_jsonb: input.details,
      status: 'unverified',
      submitted_by: input.submitted_by,
    });
  } catch {
    // offline fallback
  }
};

export const signInWithPassword = async (email: string, password: string): Promise<boolean> => {
  if (!supabase) return false; // sign-in is only possible with a configured project
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  } catch {
    return false;
  }
};

export const signOutSession = async (): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // offline
  }
};

/**
 * Returns the signed-in Supabase user (token validated against the server),
 * or null when there is no valid session. Used on boot so a forged local
 * session object can be rejected when a real Supabase project is connected.
 */
export const getSessionUser = async (): Promise<{ email: string; id: string } | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return { email: data.user.email ?? '', id: data.user.id };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Officer profiles (protected roster, keyed to auth.users(id))
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  badge_number: string | null;
  rank: string | null;
  district: string | null;
  state: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

const profileRowToOfficer = (r: ProfileRow): Officer => ({
  id: r.id,
  email: r.email,
  name: r.name,
  badgeNumber: r.badge_number ?? '—',
  rank: r.rank ?? 'Officer',
  district: r.district ?? '—',
  state: r.state ?? '—',
  phone: r.phone ?? '—',
  role: (r.role as Officer['role']) ?? 'case-officer',
  createdAt: r.created_at,
});

/** All profiles visible to the current user (admin sees the full roster). */
export const fetchProfiles = async (): Promise<Officer[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, badge_number, rank, district, state, phone, role, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as ProfileRow[]).map(profileRowToOfficer);
};

/** The current user's own profile, keyed to the validated auth session. */
export const fetchMyProfile = async (): Promise<Officer | null> => {
  const su = await getSessionUser();
  if (!supabase || !su) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, badge_number, rank, district, state, phone, role, created_at')
    .eq('id', su.id)
    .maybeSingle();
  if (error || !data) return null;
  return profileRowToOfficer(data as ProfileRow);
};

export interface CreateOfficerResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Creates a Supabase Auth user plus a linked profile row. Client keys cannot
 * create/delete auth users directly, so signUp() is used; the returned auth
 * user id keys the profile. Requires the signed-in caller to be an admin
 * (enforced both here and by RLS on profiles).
 */
export const createOfficerAccount = async (
  o: Omit<Officer, 'id' | 'createdAt'>,
  password: string,
): Promise<CreateOfficerResult> => {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };
  const { data, error } = await supabase.auth.signUp({ email: o.email.trim(), password });
  if (error || !data?.user?.id) {
    return { ok: false, error: error?.message || 'Could not create the Auth account.' };
  }
  const { error: insertError } = await supabase.from('profiles').insert({
    id: data.user.id,
    email: o.email.trim(),
    name: o.name,
    badge_number: o.badgeNumber,
    rank: o.rank,
    district: o.district,
    state: o.state,
    phone: o.phone,
    role: o.role,
  });
  if (insertError) {
    return { ok: false, error: `Auth account created but profile insert failed: ${insertError.message}` };
  }
  return { ok: true, id: data.user.id };
};

export const updateOfficerRow = async (
  id: string,
  patch: Partial<Pick<Officer, 'name' | 'rank' | 'badgeNumber' | 'district' | 'state' | 'phone' | 'role'>>,
): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('profiles').update({
      name: patch.name,
      rank: patch.rank,
      badge_number: patch.badgeNumber,
      district: patch.district,
      state: patch.state,
      phone: patch.phone,
      role: patch.role,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  } catch {
    // offline / policy-denied → keep in-memory state as source of truth
  }
};

export const deleteOfficerRow = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('profiles').delete().eq('id', id);
  } catch {
    // offline fallback
  }
};

export const persistFirDocument = async (d: {
  ref: string;
  fir_number: string;
  police_station: string;
  district: string;
  state: string;
  incident_date: string;
  incident_time: string;
  sections_law: string;
  complainant_name: string;
  complainant_age: string;
  complainant_father: string;
  complainant_address: string;
  complainant_phone: string;
  subject_name: string;
  subject_aliases: string;
  accused_details: string;
  incident_location: string;
  incident_description: string;
  evidence_summary: string;
  io_name: string;
  io_rank: string;
  report_ref: string | null;
  ocr_source: string | null;
  attachments: unknown[];
  created_by: string;
}): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('fir_documents').upsert(
      { ...d, updated_at: new Date().toISOString() },
      { onConflict: 'ref' },
    );
  } catch {
    // offline fallback
  }
};

// ---------------------------------------------------------------------------
// Case graph + history reads (public/permissive read; source of truth is the
// database when a project is configured).
// ---------------------------------------------------------------------------

type EntityRow = {
  id: string;
  type: string;
  name: string;
  attributes: Record<string, string> | null;
  risk_score: number;
};

type RelationshipRow = {
  id: string;
  source: string;
  target: string;
  type: string;
  counts: number;
  timestamps: unknown;
  linked_crime_event_id: string | null;
};

type CrimeEventRow = {
  id: string;
  fir_number: string;
  incident_date: string;
  location: string | null;
  involved_entity_ids: unknown;
};

export const fetchEntities = async (): Promise<Entity[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('entities').select('id, type, name, attributes, risk_score');
  if (error || !data) return [];
  return (data as EntityRow[]).map(r => ({
    id: r.id,
    type: r.type as Entity['type'],
    name: r.name,
    attributes: r.attributes ?? {},
    riskScore: Number(r.risk_score) || 0,
  }));
};

export const fetchRelationships = async (): Promise<Relationship[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('relationships').select('source, target, type, counts, timestamps, linked_crime_event_id');
  if (error || !data) return [];
  return (data as RelationshipRow[]).map(r => ({
    source: r.source,
    target: r.target,
    type: r.type as Relationship['type'],
    count: Number(r.counts) || 1,
    timestamps: Array.isArray(r.timestamps) ? (r.timestamps as string[]).map(String) : [],
    linkedCrimeEventId: r.linked_crime_event_id ?? undefined,
  }));
};

export const fetchCrimeEvents = async (): Promise<CrimeEvent[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('crime_events').select('id, fir_number, incident_date, location, involved_entity_ids');
  if (error || !data) return [];
  return (data as CrimeEventRow[]).map(r => ({
    id: r.id,
    firNumber: r.fir_number,
    date: r.incident_date,
    location: r.location ?? '—',
    involvedEntityIds: Array.isArray(r.involved_entity_ids) ? (r.involved_entity_ids as string[]) : [],
  }));
};

type AuditRow = {
  id: string;
  actor_name: string | null;
  action: string;
  level: string;
  summary: string;
  target: string | null;
  created_at: string;
};

export const fetchAuditLogs = async (): Promise<AuditLogEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_name, action, level, summary, target, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as AuditRow[]).map(r => ({
    id: r.id,
    timestamp: r.created_at,
    actor: r.actor_name ?? 'System',
    action: r.action as AuditLogEntry['action'],
    level: r.level === 'warn' || r.level === 'critical' ? r.level : 'info',
    summary: r.summary,
    target: r.target ?? undefined,
  }));
};

type ReportRow = {
  id: string;
  ref: string;
  fir_number: string | null;
  subject_name: string;
  incident_location: string | null;
  details_jsonb: unknown;
  submitted_by: string | null;
  created_at: string;
};

export const fetchReports = async (): Promise<SubmittedReport[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id, ref, fir_number, subject_name, incident_location, details_jsonb, submitted_by, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as ReportRow[]).map(r => ({
    id: r.ref ?? r.id,
    firNumber: r.fir_number ?? r.ref ?? '',
    incidentLocation: r.incident_location ?? undefined,
    subjectName: r.subject_name,
    detailCount: Array.isArray(r.details_jsonb) ? (r.details_jsonb as unknown[]).length : 0,
    details: Array.isArray(r.details_jsonb) ? ((r.details_jsonb as ReportDetail[]).map(d => ({
      id: d.id ?? crypto.randomUUID(),
      kind: d.kind,
      value: d.value,
      meta: d.meta,
      note: d.note,
      tags: d.tags ?? [],
      createdAt: d.createdAt ?? r.created_at,
    }))) : [],
    submittedAt: r.created_at,
    submittedBy: r.submitted_by ?? 'System',
  }));
};

type FirRow = {
  id: string;
  ref: string;
  fir_number: string | null;
  police_station: string | null;
  district: string | null;
  state: string | null;
  incident_date: string | null;
  incident_time: string | null;
  sections_law: string | null;
  complainant_name: string | null;
  complainant_age: string | null;
  complainant_father: string | null;
  complainant_address: string | null;
  complainant_phone: string | null;
  subject_name: string | null;
  subject_aliases: string | null;
  accused_details: string | null;
  incident_location: string | null;
  incident_description: string | null;
  evidence_summary: string | null;
  io_name: string | null;
  io_rank: string | null;
  report_ref: unknown;
  ocr_source: string | null;
  attachments: unknown;
  created_by: string | null;
  created_at: string;
};

export const fetchFirDocuments = async (): Promise<FirDocument[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('fir_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as FirRow[]).map(r => ({
    id: r.id,
    ref: r.ref,
    firNumber: r.fir_number ?? '',
    policeStation: r.police_station ?? '',
    district: r.district ?? '',
    state: r.state ?? '',
    incidentDate: r.incident_date ?? '',
    incidentTime: r.incident_time ?? '',
    sectionsLaw: r.sections_law ?? '',
    complainantName: r.complainant_name ?? '',
    complainantAge: r.complainant_age ?? '',
    complainantFather: r.complainant_father ?? '',
    complainantAddress: r.complainant_address ?? '',
    complainantPhone: r.complainant_phone ?? '',
    subjectName: r.subject_name ?? '',
    subjectAliases: r.subject_aliases ?? '',
    accusedDetails: r.accused_details ?? '',
    incidentLocation: r.incident_location ?? '',
    incidentDescription: r.incident_description ?? '',
    evidenceSummary: r.evidence_summary ?? '',
    ioName: r.io_name ?? '',
    ioRank: r.io_rank ?? '',
    reportRef: Array.isArray(r.report_ref) ? (r.report_ref as string[])[0] ?? undefined : (r.report_ref as string | null) ?? undefined,
    ocrSource: r.ocr_source ?? undefined,
    attachments: (r.attachments as FirAttachment[]) ?? [],
    createdAt: r.created_at,
    createdBy: r.created_by ?? 'System',
  }));
};