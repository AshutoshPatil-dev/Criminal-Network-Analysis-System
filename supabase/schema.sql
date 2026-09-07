-- Nexus — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Then set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the frontend.

-- NOTE: policies below are intentionally permissive for the hackathon demo (read/write for anon).
-- Before any production use, restrict everything to authenticated roles and RLS on auth.uid().

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Case data (currently mocked in the frontend; seed here to share across users)
-- ---------------------------------------------------------------------------
create table if not exists public.entities (
  id text primary key,
  type text not null check (type in ('person','phone','vehicle','location','org')),
  name text not null,
  attributes jsonb not null default '{}',
  risk_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  source text not null references public.entities (id),
  target text not null references public.entities (id),
  type text not null check (type in ('call','meeting','transaction','associate','co-accused','ownership')),
  counts numeric not null default 1,
  timestamps jsonb not null default '[]',
  linked_crime_event_id text
);

create table if not exists public.crime_events (
  id text primary key,
  fir_number text not null unique,
  incident_date date not null,
  location text,
  involved_entity_ids jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- Reports & detail change history (the "New Report" flow)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  fir_number text,
  subject_name text not null,
  incident_location text,
  details_jsonb jsonb not null default '[]',   -- {kind, value, meta, note, tags}[]
  status text not null default 'unverified',
  submitted_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_detail_history (
  id uuid primary key default gen_random_uuid(),
  report_ref text not null references public.reports (ref),
  kind text not null,
  value text not null,
  meta text,
  note text,
  tags jsonb not null default '[]',
  action text not null check (action in ('add','edit','remove')),
  changed_by text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log (immutable trail — who did what, when)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  actor_name text,
  action text not null,
  level text not null default 'info' check (level in ('info','warn','critical')),
  summary text not null,
  target text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Officers (law-enforcement user profiles: rank, badge, district, contact)
-- ---------------------------------------------------------------------------
create table if not exists public.officers (
  id text primary key,
  name text not null,
  badge_number text,
  rank text,
  district text,
  state text,
  email text unique,
  phone text,
  role text not null default 'case-officer' check (role in ('case-officer','analyst','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- FIR documents (printable/exportable records, with OCR source + attachments)
-- ---------------------------------------------------------------------------
create table if not exists public.fir_documents (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  fir_number text,
  police_station text,
  district text,
  state text,
  incident_date text,
  incident_time text,
  sections_law text,
  complainant_name text,
  complainant_age text,
  complainant_father text,
  complainant_address text,
  complainant_phone text,
  subject_name text,
  subject_aliases text,
  accused_details text,
  incident_location text,
  incident_description text,
  evidence_summary text,
  io_name text,
  io_rank text,
  report_ref text [],
  ocr_source text,
  attachments jsonb not null default '[]',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Row Level Security (demo-permissive)
-- ---------------------------------------------------------------------------
alter table public.entities enable row level security;
alter table public.relationships enable row level security;
alter table public.crime_events enable row level security;
alter table public.reports enable row level security;
alter table public.report_detail_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.officers enable row level security;
alter table public.fir_documents enable row level security;

create policy "demo read entities" on public.entities for select using (true);
create policy "demo read relationships" on public.relationships for select using (true);
create policy "demo read crime_events" on public.crime_events for select using (true);
create policy "demo write reports" on public.reports for all using (true) with check (true);
create policy "demo write detail_history" on public.report_detail_history for all using (true) with check (true);
create policy "demo insert audit_logs" on public.audit_logs for insert with check (true);
create policy "demo read audit_logs" on public.audit_logs for select using (true);
create policy "demo write officers" on public.officers for all using (true) with check (true);
create policy "demo read officers" on public.officers for select using (true);
create policy "demo write fir_documents" on public.fir_documents for all using (true) with check (true);
create policy "demo read fir_documents" on public.fir_documents for select using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for CDR / file uploads (private by default)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('case-files', 'case-files', false)
on conflict (id) do nothing;

create policy "demo upload case-files" on storage.objects
  for insert to authenticated, anon
  with check (bucket_id = 'case-files');

create policy "demo read case-files" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'case-files');