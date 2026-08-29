-- Radio "opowiadania" — osobna szuflada od muzyki, grana o stałych porach:
--   evening_horror  → 21:00 codziennie (dla dorosłych)
--   morning_kids    → 08:00 codziennie (dla dzieci)
-- Nie jest częścią radio_schedule (tam leci tylko muzyka) — radio-stream
-- podmienia bieżący plik tylko w oknie czasowym danego slotu.
create table if not exists public.radio_story_slots (
  id            uuid primary key default gen_random_uuid(),
  slot          text not null check (slot in ('evening_horror', 'morning_kids')),
  title         text not null,
  audio_url     text not null,
  duration_sec  integer not null default 600,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_radio_story_slots_slot on public.radio_story_slots(slot, is_active);

alter table public.radio_story_slots enable row level security;

-- Odczyt publiczny (radio-stream używa service_role, ale strona może chcieć podejrzeć listę).
drop policy if exists "radio_story_slots_select_public" on public.radio_story_slots;
create policy "radio_story_slots_select_public"
  on public.radio_story_slots for select
  using (true);

-- Zapis tylko dla adminów (ten sam wzorzec co reszta panelu: has_role(uid, 'admin')).
drop policy if exists "radio_story_slots_admin_write" on public.radio_story_slots;
create policy "radio_story_slots_admin_write"
  on public.radio_story_slots for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
