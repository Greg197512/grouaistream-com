-- Odbiór kodów dostępu (unlock_codes) przez użytkowników — brakujący element:
-- panel admina zarządzał kodami, ale nikt nie miał jak ich wpisać/wykorzystać.
create table if not exists public.code_redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  code_id      uuid not null references public.unlock_codes(id) on delete cascade,
  redeemed_at  timestamptz not null default now(),
  unique (user_id, code_id)
);

create index if not exists idx_code_redemptions_user on public.code_redemptions(user_id);

alter table public.code_redemptions enable row level security;

-- Użytkownik widzi tylko własne odbiory. Zapis wyłącznie przez service_role
-- (edge function redeem-code) — walidacja (plan Pro/Ultimate + aktywność kodu)
-- musi być po stronie serwera, nie w przeglądarce.
drop policy if exists "code_redemptions_select_own" on public.code_redemptions;
create policy "code_redemptions_select_own"
  on public.code_redemptions for select
  using (auth.uid() = user_id);
