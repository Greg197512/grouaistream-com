-- Zapisane projekty GrouAI Studio DAW: układ ścieżek, ustawienia brzmienia i adresy klipów (R2).
create table if not exists public.daw_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Projekt',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_daw_projects_user on public.daw_projects (user_id, updated_at desc);
alter table public.daw_projects enable row level security;
drop policy if exists "daw_projects own" on public.daw_projects;
create policy "daw_projects own" on public.daw_projects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
notify pgrst, 'reload schema';
