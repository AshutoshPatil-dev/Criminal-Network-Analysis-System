import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  if (!supabase) return true; // offline demo — validation handled locally
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  } catch {
    return false;
  }
};

export const signUpWithEmail = async (email: string, password: string): Promise<boolean> => {
  if (!supabase) return true;
  try {
    const { error } = await supabase.auth.signUp({ email, password });
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

export const persistOfficer = async (o: {
  id: string;
  badgeNumber: string;
  name: string;
  rank: string;
  district: string;
  state: string;
  email: string;
  phone: string;
  role: string;
}): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('officers').upsert(
      {
        id: o.id,
        badge_number: o.badgeNumber,
        name: o.name,
        rank: o.rank,
        district: o.district,
        state: o.state,
        email: o.email,
        phone: o.phone,
        role: o.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  } catch {
    // offline fallback
  }
};

export const deleteOfficerRow = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    await supabase.from('officers').delete().eq('id', id);
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