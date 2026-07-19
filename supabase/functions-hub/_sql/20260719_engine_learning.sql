-- HUB (bmwtydwpevzhbdplilbr) — zastosowane 2026-07-19 przez MCP apply_migration.
-- Zbiór uczący GrouAI Engine: każda generacja zapisuje profil emocjonalny
-- (aura z detekcji twarzy) + finalny plan utworu. Na tej bazie silnik jest
-- strojony (personalizacja parametrów muzycznych per użytkownik / globalnie).
CREATE TABLE IF NOT EXISTS public.engine_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  source text NOT NULL DEFAULT 'studio',   -- studio | studio-direct | aura | api
  prompt text,
  language text,
  aura jsonb,        -- profil emocjonalny użyty do warunkowania
  plan jsonb,        -- tytuł / tagi / tekst / czas
  engine text,       -- minimax | acestep
  task_id text,
  feedback numeric   -- przyszłość: ocena użytkownika (like / skip / replay)
);

CREATE INDEX IF NOT EXISTS idx_engine_learning_user
  ON public.engine_learning (user_id, created_at DESC);

-- RLS włączone bez polityk = dostęp wyłącznie przez service_role (funkcje huba).
ALTER TABLE public.engine_learning ENABLE ROW LEVEL SECURITY;
