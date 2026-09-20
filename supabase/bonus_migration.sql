-- Run this if you already applied an older schema.sql
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS patterns)

-- Extend roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'technician', 'viewer'));

-- Technician fields
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists employee_code text;
alter table public.profiles add column if not exists specialty text;
alter table public.profiles add column if not exists shift text;

-- Waiting Part status
alter table public.maintenance_records drop constraint if exists maintenance_records_status_check;
alter table public.maintenance_records
  add constraint maintenance_records_status_check
  check (status in ('Open', 'In Progress', 'Waiting Part', 'Closed'));

-- Audit log table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_alarms_occurred on public.alarms (occurred_at);

alter table public.audit_logs enable row level security;

drop policy if exists "Authenticated can read audit" on public.audit_logs;
create policy "Authenticated can read audit"
  on public.audit_logs for select
  to authenticated
  using (true);

drop policy if exists "Authenticated can insert audit" on public.audit_logs;
create policy "Authenticated can insert audit"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- Tighten alarm/maintenance write policies (viewer read-only)
drop policy if exists "Authenticated can insert alarms" on public.alarms;
drop policy if exists "Staff can insert alarms" on public.alarms;
create policy "Staff can insert alarms"
  on public.alarms for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'technician'));

drop policy if exists "Authenticated can update alarms" on public.alarms;
drop policy if exists "Staff can update alarms" on public.alarms;
create policy "Staff can update alarms"
  on public.alarms for update
  to authenticated
  using (public.current_user_role() in ('admin', 'technician'));

drop policy if exists "Authenticated can insert maintenance" on public.maintenance_records;
drop policy if exists "Staff can insert maintenance" on public.maintenance_records;
create policy "Staff can insert maintenance"
  on public.maintenance_records for insert
  to authenticated
  with check (public.current_user_role() in ('admin', 'technician'));

drop policy if exists "Authenticated can update maintenance" on public.maintenance_records;
drop policy if exists "Staff can update maintenance" on public.maintenance_records;
create policy "Staff can update maintenance"
  on public.maintenance_records for update
  to authenticated
  using (public.current_user_role() in ('admin', 'technician'));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.current_user_role() = 'admin');
