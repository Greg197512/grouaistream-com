-- Rozszerzenie „opowiadań radiowych": jeden plik może teraz mieć DOWOLNĄ
-- liczbę stałych godzin emisji dziennie (nie tylko jeden sztywny slot).
-- Przykład: "Efekt ciszy" ma grać codziennie o 20:30 ORAZ 22:00.

alter table public.radio_story_slots
  add column if not exists air_times time[] not null default '{}';

-- Backfill: istniejące sloty horror/dzieci dostają swoje dotychczasowe,
-- zaszyte w kodzie godziny, żeby nic się nie wyłączyło po migracji.
update public.radio_story_slots
  set air_times = array['21:00'::time]
  where slot = 'evening_horror' and air_times = '{}';

update public.radio_story_slots
  set air_times = array['08:00'::time]
  where slot = 'morning_kids' and air_times = '{}';

-- `slot` był ograniczony do 2 wartości — teraz to tylko etykieta/kategoria,
-- rzeczywisty rozkład godzin trzyma air_times. Zdejmujemy sztywny check.
alter table public.radio_story_slots drop constraint if exists radio_story_slots_slot_check;
