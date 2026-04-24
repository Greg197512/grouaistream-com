-- Aurora autonomia: propozycje, landing pages, partnerships, SEO posts, reels
create table if not exists public.aurora_revenue_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null check (action_type in ('seo_post','niche_landing','partnership','tiktok_reel','newsletter','sponsored_slot')),
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed','approved','published','rejected','failed')),
  estimated_revenue_eur numeric(10,2) default 0,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_aurora_actions_status on public.aurora_revenue_actions(status, created_at desc);
create index if not exists idx_aurora_actions_type on public.aurora_revenue_actions(action_type);

alter table public.aurora_revenue_actions enable row level security;

create policy "Admins read aurora actions"
  on public.aurora_revenue_actions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins update aurora actions"
  on public.aurora_revenue_actions for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Service role manages aurora actions"
  on public.aurora_revenue_actions for all
  using (auth.role() = 'service_role');

-- Niche landing pages (tworzone autonomicznie)
create table if not exists public.aurora_landing_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  niche text not null,
  title text not null,
  meta_description text,
  hero_headline text,
  hero_subheadline text,
  sections jsonb not null default '[]'::jsonb,
  cta_text text default 'Posłuchaj teraz',
  cta_url text default '/',
  sponsor_name text,
  sponsor_url text,
  sponsor_active boolean default false,
  sponsor_until timestamptz,
  views_count integer default 0,
  conversions_count integer default 0,
  status text not null default 'draft' check (status in ('draft','live','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_landing_slug on public.aurora_landing_pages(slug);
create index if not exists idx_landing_status on public.aurora_landing_pages(status);

alter table public.aurora_landing_pages enable row level security;

create policy "Public read live landings"
  on public.aurora_landing_pages for select
  using (status = 'live');

create policy "Admins manage landings"
  on public.aurora_landing_pages for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Service role manages landings"
  on public.aurora_landing_pages for all
  using (auth.role() = 'service_role');

-- Partnership pitches
create table if not exists public.aurora_partnerships (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  partner_type text,
  contact_email text,
  contact_url text,
  pitch_subject text,
  pitch_body text,
  estimated_value_eur numeric(10,2) default 0,
  status text not null default 'proposed' check (status in ('proposed','approved','sent','accepted','rejected','closed')),
  approved_by uuid references auth.users(id),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.aurora_partnerships enable row level security;

create policy "Admins manage partnerships"
  on public.aurora_partnerships for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Service role manages partnerships"
  on public.aurora_partnerships for all
  using (auth.role() = 'service_role');

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_aurora_actions_touch on public.aurora_revenue_actions;
create trigger trg_aurora_actions_touch before update on public.aurora_revenue_actions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_aurora_landing_touch on public.aurora_landing_pages;
create trigger trg_aurora_landing_touch before update on public.aurora_landing_pages
  for each row execute function public.touch_updated_at();