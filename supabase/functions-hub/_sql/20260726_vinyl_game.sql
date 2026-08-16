-- HUB (bmwtydwpevzhbdplilbr) — zastosowane 2026-07-26 przez MCP apply_migration.
-- Gra „Wygraj swoją płytę": rundy, losy graczy, wybory zwycięzcy. RLS bez polityk
-- = dostęp tylko service_role (funkcja game-hub). Cron 'game-draw-daily' 0 12 * * *.
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Wygraj swoją płytę',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  winner_user_id uuid, winner_email text, winner_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.game_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, email text, display_name text,
  tickets int NOT NULL DEFAULT 0, last_daily date,
  day_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_game_entries_lb ON public.game_entries (round_id, tickets DESC);
CREATE TABLE IF NOT EXISTS public.game_winner_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.game_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, track_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  medium text NOT NULL DEFAULT 'vinyl',
  ship_name text, ship_address text, ship_email text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id)
);
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_winner_picks ENABLE ROW LEVEL SECURITY;
