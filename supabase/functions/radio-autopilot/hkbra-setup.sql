-- Groua Radio Autopilot — setup na projekcie hkbra (scheduler).
-- Uruchom w SQL editor projektu hkbraboqdsonekzxbntr.
--
-- 1) Tabela logu zdrowia radia (heartbeat bota-stróża).
create table if not exists public.radio_autopilot_log (
  id           bigint generated always as identity primary key,
  checked_at   timestamptz not null default now(),
  stream_ok    boolean,
  http_status  integer,
  hls_segments integer,
  station_name text,
  now_title    text,
  now_artist   text,
  note         text
);

create index if not exists radio_autopilot_log_checked_at_idx
  on public.radio_autopilot_log (checked_at desc);

-- RLS: tabela techniczna, funkcja używa service_role (omija RLS).
-- Zostawiamy bez publicznych policy — brak dostępu anon.
alter table public.radio_autopilot_log enable row level security;

-- 2) Cron co 30 min — wywołuje funkcję radio-autopilot (po jej wdrożeniu).
--    Wymaga rozszerzeń pg_cron + pg_net (są już aktywne na hkbra).
--    Podmień <HKBRA_ANON_KEY> na anon key projektu hkbra.
select cron.schedule(
  'radio-autopilot-watchdog',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://hkbraboqdsonekzxbntr.supabase.co/functions/v1/radio-autopilot',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <HKBRA_ANON_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Podgląd: select * from cron.job where jobname = 'radio-autopilot-watchdog';
-- Usunięcie: select cron.unschedule('radio-autopilot-watchdog');
