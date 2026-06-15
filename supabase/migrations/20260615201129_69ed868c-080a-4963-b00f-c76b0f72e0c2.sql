ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS lyrics text;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS engine text DEFAULT 'musicgen';