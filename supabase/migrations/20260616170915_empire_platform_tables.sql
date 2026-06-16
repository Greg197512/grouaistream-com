-- Empire Platform: core tables

-- Projects
create table if not exists public.empire_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','draft','archived')),
  gradient text default 'from-teal-500 to-purple-600',
  agent_count integer default 0,
  content_count integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.empire_projects enable row level security;
create policy "Users manage own projects"
  on public.empire_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Agent Teams
create table if not exists public.empire_agent_teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.empire_projects(id) on delete set null,
  name text not null,
  nodes jsonb not null default '[]',
  status text not null default 'idle' check (status in ('idle','running','done','error')),
  last_run_at timestamptz,
  run_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.empire_agent_teams enable row level security;
create policy "Users manage own agent teams"
  on public.empire_agent_teams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Knowledge Garden Notes
create table if not exists public.empire_knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  content text,
  type text not null default 'note' check (type in ('note','link','image','insight')),
  tags text[] default '{}',
  starred boolean default false,
  ai_insight text,
  source_url text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.empire_knowledge_notes enable row level security;
create policy "Users manage own notes"
  on public.empire_knowledge_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Research Jobs (Apify history)
create table if not exists public.empire_research_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  mode text not null check (mode in ('google','website','tiktok','youtube')),
  query text not null,
  status text not null default 'running' check (status in ('running','done','error')),
  results jsonb default '[]',
  error_message text,
  result_count integer default 0,
  duration_seconds integer,
  apify_run_id text,
  created_at timestamptz default now()
);

alter table public.empire_research_jobs enable row level security;
create policy "Users manage own research jobs"
  on public.empire_research_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Empire KPI snapshots (daily)
create table if not exists public.empire_kpi_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  snapshot_date date not null default current_date,
  content_generated integer default 0,
  estimated_views integer default 0,
  estimated_revenue_usd numeric(10,2) default 0,
  active_agents integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique (user_id, snapshot_date)
);

alter table public.empire_kpi_snapshots enable row level security;
create policy "Users manage own KPIs"
  on public.empire_kpi_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace trigger empire_projects_updated_at
  before update on public.empire_projects
  for each row execute function public.set_updated_at();

create or replace trigger empire_agent_teams_updated_at
  before update on public.empire_agent_teams
  for each row execute function public.set_updated_at();

create or replace trigger empire_knowledge_notes_updated_at
  before update on public.empire_knowledge_notes
  for each row execute function public.set_updated_at();
