-- GrandmaCRM baseline schema for Supabase/Postgres
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

-- ===== enums =====
do $$
begin
  if not exists (select 1 from pg_type where typname = 'crm_urgency') then
    create type crm_urgency as enum ('high', 'medium', 'low');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('pending', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'reminder_status') then
    create type reminder_status as enum ('pending', 'sent', 'failed', 'cancelled');
  end if;
end$$;

-- ===== users/profile =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== core crm =====
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  remark_name text not null default '',
  phone text,
  wechat text,
  birthday date,
  status text not null default 'new',
  urgency crm_urgency not null default 'medium',
  tags text[] not null default '{}',
  requirements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_owner_idx on public.clients(owner_id);
create index if not exists clients_owner_status_idx on public.clients(owner_id, status);
create index if not exists clients_owner_urgency_idx on public.clients(owner_id, urgency);
create index if not exists clients_tags_gin_idx on public.clients using gin(tags);
create index if not exists clients_requirements_gin_idx on public.clients using gin(requirements);

create table if not exists public.client_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  content text not null,
  log_date date not null default current_date,
  images text[] not null default '{}',
  next_action text,
  next_action_todo text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_logs_owner_client_idx on public.client_logs(owner_id, client_id);
create index if not exists client_logs_owner_due_idx on public.client_logs(owner_id, due_date);
create index if not exists client_logs_owner_created_idx on public.client_logs(owner_id, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  source_log_id uuid references public.client_logs(id) on delete set null,
  title text not null,
  due_at timestamptz not null,
  status task_status not null default 'pending',
  created_by text not null default 'user',
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_owner_status_due_idx on public.tasks(owner_id, status, due_at);
create index if not exists tasks_owner_client_idx on public.tasks(owner_id, client_id);

create table if not exists public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  channel text not null default 'inapp',
  due_at timestamptz not null,
  status reminder_status not null default 'pending',
  retry_count int not null default 0,
  error_message text,
  sent_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminder_jobs_owner_status_due_idx on public.reminder_jobs(owner_id, status, due_at);

-- ===== ai runtime =====
create table if not exists public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null,
  last_client_id uuid references public.clients(id) on delete set null,
  last_intent text,
  pending_draft jsonb not null default '{}'::jsonb,
  turn_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, session_key)
);

create index if not exists ai_sessions_owner_updated_idx on public.ai_sessions(owner_id, updated_at desc);

create table if not exists public.client_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  fact_key text not null,
  fact_value text not null,
  confidence numeric(3,2) not null default 0.50,
  source_log_id uuid references public.client_logs(id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_memories_unique_fact on public.client_memories(owner_id, client_id, fact_key, fact_value);
create index if not exists client_memories_owner_client_idx on public.client_memories(owner_id, client_id);

create table if not exists public.ai_actions_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  trace_id text not null,
  intent text,
  tool text,
  status text not null,
  latency_ms int,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ai_actions_owner_created_idx on public.ai_actions_log(owner_id, created_at desc);
create index if not exists ai_actions_trace_idx on public.ai_actions_log(trace_id);

-- ===== updated_at helper =====
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists trg_client_logs_updated_at on public.client_logs;
create trigger trg_client_logs_updated_at before update on public.client_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_reminder_jobs_updated_at on public.reminder_jobs;
create trigger trg_reminder_jobs_updated_at before update on public.reminder_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_ai_sessions_updated_at on public.ai_sessions;
create trigger trg_ai_sessions_updated_at before update on public.ai_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_client_memories_updated_at on public.client_memories;
create trigger trg_client_memories_updated_at before update on public.client_memories
for each row execute function public.set_updated_at();

-- ===== row level security =====
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_logs enable row level security;
alter table public.tasks enable row level security;
alter table public.reminder_jobs enable row level security;
alter table public.ai_sessions enable row level security;
alter table public.client_memories enable row level security;
alter table public.ai_actions_log enable row level security;

drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists clients_owner_all on public.clients;
create policy clients_owner_all on public.clients
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists client_logs_owner_all on public.client_logs;
create policy client_logs_owner_all on public.client_logs
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists reminder_jobs_owner_all on public.reminder_jobs;
create policy reminder_jobs_owner_all on public.reminder_jobs
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ai_sessions_owner_all on public.ai_sessions;
create policy ai_sessions_owner_all on public.ai_sessions
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists client_memories_owner_all on public.client_memories;
create policy client_memories_owner_all on public.client_memories
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ai_actions_owner_all on public.ai_actions_log;
create policy ai_actions_owner_all on public.ai_actions_log
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
