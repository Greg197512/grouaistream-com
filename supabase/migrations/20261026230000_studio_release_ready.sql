-- GrouAI Studio → Spotify Ready: pakiet wydania (WAV po masteringu, okładka 3000×3000,
-- czysty tekst, wyniki kontroli) i znaczek „✓ GrouAI Studio” na utworze w katalogu.
alter table public.generations add column if not exists release jsonb;
alter table public.tracks add column if not exists studio_certified boolean not null default false;
alter table public.tracks add column if not exists release jsonb;
create index if not exists idx_tracks_studio_certified on public.tracks (created_at desc) where studio_certified;
notify pgrst, 'reload schema';
