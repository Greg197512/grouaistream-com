-- Prośby słuchaczy o utwór w radiu („zagraj X o 20:00").
-- Każda prośba = utwór z katalogu (track_id) albo wideo z YouTube (youtube_id),
-- zagrany o podanej godzinie (play_at) na wybranej stacji.
-- Klienci radia (RadioLive) same odpalają prośbę, gdy nadejdzie jej czas.

create table if not exists public.radio_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_name text,
  station text not null default 'public' check (station in ('public', 'vip')),
  track_id uuid references public.tracks(id) on delete set null,
  youtube_id text,
  title text not null,
  artist text,
  play_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint radio_requests_source_chk check (track_id is not null or youtube_id is not null)
);

create index if not exists radio_requests_play_at_idx on public.radio_requests (play_at);

alter table public.radio_requests enable row level security;

drop policy if exists "radio_requests_read" on public.radio_requests;
create policy "radio_requests_read" on public.radio_requests
  for select using (true);

drop policy if exists "radio_requests_insert_own" on public.radio_requests;
create policy "radio_requests_insert_own" on public.radio_requests
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and play_at > now() - interval '2 minutes'
    and play_at < now() + interval '24 hours'
  );

drop policy if exists "radio_requests_delete_own_or_admin" on public.radio_requests;
create policy "radio_requests_delete_own_or_admin" on public.radio_requests
  for delete to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Limit: maks. 5 próśb na użytkownika na dobę (ochrona przed spamem).
create or replace function public.radio_requests_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.radio_requests
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Limit próśb: 5 na dobę. Spróbuj jutro.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists radio_requests_limit on public.radio_requests;
create trigger radio_requests_limit
  before insert on public.radio_requests
  for each row execute function public.radio_requests_daily_limit();

-- Realtime: nowa prośba od razu trafia do słuchaczy radia.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'radio_requests'
  ) then
    alter publication supabase_realtime add table public.radio_requests;
  end if;
end $$;

notify pgrst, 'reload schema';
