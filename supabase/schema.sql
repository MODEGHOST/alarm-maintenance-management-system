-- Alarm & Maintenance Management System
-- Run this SQL in Supabase SQL Editor (full schema)

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('admin', 'technician', 'viewer')) default 'technician',
  phone text,
  employee_code text,
  specialty text,
  shift text,
  created_at timestamptz not null default now()
);

-- Machines
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  machine_id text not null unique,
  machine_name text not null,
  machine_type text not null,
  location text not null,
  status text not null check (status in ('Running', 'Stop', 'Alarm', 'Maintenance')) default 'Stop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Alarms
create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  machine_uuid uuid not null references public.machines (id) on delete cascade,
  alarm_code text not null,
  alarm_description text not null,
  occurred_at timestamptz not null default now(),
  cause text,
  status text not null check (status in ('Open', 'In Progress', 'Closed')) default 'Open',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Maintenance records (includes Waiting Part)
create table if not exists public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  machine_uuid uuid not null references public.machines (id) on delete cascade,
  title text not null,
  description text,
  technician_id uuid references public.profiles (id),
  status text not null check (status in ('Open', 'In Progress', 'Waiting Part', 'Closed')) default 'Open',
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit log
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

create index if not exists idx_alarms_machine on public.alarms (machine_uuid);
create index if not exists idx_alarms_status on public.alarms (status);
create index if not exists idx_alarms_occurred on public.alarms (occurred_at);
create index if not exists idx_maintenance_machine on public.maintenance_records (machine_uuid);
create index if not exists idx_maintenance_status on public.maintenance_records (status);
create index if not exists idx_machines_status on public.machines (status);
create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_profiles_role on public.profiles (role);

-- Auto-create profile on signup (ห้ามยกระดับเป็น admin จาก metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'technician'));
  if requested_role = 'viewer' then
    safe_role := 'viewer';
  else
    safe_role := 'technician';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    safe_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Allow authenticated users to insert their own profile (fallback from app)
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (
    auth.uid() = id
    and role in ('technician', 'viewer')
  );

-- Helper: current user role
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.alarms enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles policies
drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.current_user_role() = 'admin')
  with check (
    public.current_user_role() = 'admin'
    or (
      auth.uid() = id
      and role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );

drop policy if exists "Admin can update any profile" on public.profiles;
create policy "Admin can update any profile"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Machines policies
drop policy if exists "Authenticated can read machines" on public.machines;
create policy "Authenticated can read machines"
  on public.machines for select
  to authenticated
  using (true);

drop policy if exists "Admin can insert machines" on public.machines;
create policy "Admin can insert machines"
  on public.machines for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admin can update machines" on public.machines;
create policy "Admin can update machines"
  on public.machines for update
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy if exists "Admin can delete machines" on public.machines;
create policy "Admin can delete machines"
  on public.machines for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- Alarms policies (viewer = read only)
drop policy if exists "Authenticated can read alarms" on public.alarms;
create policy "Authenticated can read alarms"
  on public.alarms for select
  to authenticated
  using (true);

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

-- Maintenance policies (viewer = read only)
drop policy if exists "Authenticated can read maintenance" on public.maintenance_records;
create policy "Authenticated can read maintenance"
  on public.maintenance_records for select
  to authenticated
  using (true);

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

-- Audit logs
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
