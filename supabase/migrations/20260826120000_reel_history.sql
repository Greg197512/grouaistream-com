-- Historia oglądania rolek (na koncie, między urządzeniami) — do budowania
-- zainteresowań użytkownika (np. Nostalgia DNA / rekomendacje).
create table if not exists public.reel_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'youtube',   -- 'youtube' | 'track'
  video_id text,
  track_id uuid,
  title text,
  artist text,
  era text,
  created_at timestamptz not null default now()
);

alter table public.reel_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_history' and policyname = 'reel_history_select_own') then
    create policy "reel_history_select_own" on public.reel_history for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_history' and policyname = 'reel_history_insert_own') then
    create policy "reel_history_insert_own" on public.reel_history for insert with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists reel_history_user_idx on public.reel_history (user_id, created_at desc);
