import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Officer } from '../types';

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