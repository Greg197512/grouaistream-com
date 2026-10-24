-- Migracja mediów na R2 sterowana z Vercela (api/migrate-media.ts).
-- Dostęp tylko z jednorazowym tokenem: tabela trzyma wyłącznie skrót SHA-256 i datę ważności,
-- a zapis przyjmuje tylko adresy z naszego publicznego R2.

create table if not exists public.media_migration_token (
  token_hash text primary key,
  expires_at timestamptz not null
);
alter table public.media_migration_token enable row level security; -- brak polityk = brak dostępu z API

create or replace function public.mm_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.media_migration_token
    where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
      and expires_at > now()
  );
$$;

create or replace function public.mm_candidates(p_token text, p_after uuid, p_limit int)
returns table (id uuid, audio_url text, cover_url text, video_url text)
language plpgsql stable security definer set search_path = public as $$
declare r2 constant text := 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev/%';
begin
  if not public.mm_token_ok(p_token) then
    raise exception 'invalid or expired migration token' using errcode = '42501';
  end if;
  return query
    select t.id, t.audio_url, t.cover_url, t.video_url
    from public.tracks t
    where (p_after is null or t.id > p_after)
      and (
        (t.audio_url ~* '^https?://' and t.audio_url not like r2)
        or (t.cover_url ~* '^https?://' and t.cover_url not like r2)
        or (t.video_url ~* '^https?://.*\.(mp4|webm|mov|m4v)(\?|$)' and t.video_url not like r2)
      )
    order by t.id
    limit least(greatest(coalesce(p_limit, 40), 1), 200);
end;
$$;

create or replace function public.mm_apply(p_token text, p_id uuid, p_field text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.mm_token_ok(p_token) then
    raise exception 'invalid or expired migration token' using errcode = '42501';
  end if;
  if p_url not like 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev/%' then
    raise exception 'only R2 urls accepted' using errcode = '22023';
  end if;
  if p_field = 'audio_url' then update public.tracks set audio_url = p_url where id = p_id;
  elsif p_field = 'cover_url' then update public.tracks set cover_url = p_url where id = p_id;
  elsif p_field = 'video_url' then update public.tracks set video_url = p_url where id = p_id;
  else raise exception 'bad field' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.mm_candidates(text, uuid, int) from public;
revoke all on function public.mm_apply(text, uuid, text, text) from public;
grant execute on function public.mm_candidates(text, uuid, int) to anon, authenticated;
grant execute on function public.mm_apply(text, uuid, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
