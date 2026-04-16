
-- Tabela: zapis sklonowanych głosów ElevenLabs per user
CREATE TABLE IF NOT EXISTS public.user_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  voice_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Mój głos',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, voice_id)
);

CREATE INDEX IF NOT EXISTS idx_user_voices_user ON public.user_voices(user_id);

ALTER TABLE public.user_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voices" ON public.user_voices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own voices" ON public.user_voices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own voices" ON public.user_voices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own voices" ON public.user_voices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Funkcja: ile darmowych generacji wykorzystał user (limit 1 dla free)
CREATE OR REPLACE FUNCTION public.get_user_generation_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.generations
  WHERE user_id = _user_id AND status = 'completed';
$$;
