-- Nexus migration: officer roster on auth-linked profiles
-- Paste in the Supabase SQL Editor and run once. Safe to re-run (idempotent).
-- For a fresh project, the full schema in schema.sql already includes all of this.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  badge_number text,
  rank text,
  district text,
  state text,
  phone text,
  role text not null default 'case-officer' check (role in ('case-officer','analyst','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert admin only" on public.profiles;
create policy "profiles insert admin only" on public.profiles
  for insert with check (public.is_admin());

drop policy if exists "profiles update admin only" on public.profiles;
create policy "profiles update admin only" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles delete admin only" on public.profiles;
create policy "profiles delete admin only" on public.profiles
  for delete using (public.is_admin());

-- The old, now-unused officers table from the earlier schema:
drop table if exists public.officers;