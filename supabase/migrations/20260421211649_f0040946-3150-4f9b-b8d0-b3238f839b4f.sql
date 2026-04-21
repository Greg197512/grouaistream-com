-- Add language metadata to radio_announcements for multilingual audio
ALTER TABLE public.radio_announcements
  ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'pl';

CREATE INDEX IF NOT EXISTS idx_radio_announcements_lang_kind
  ON public.radio_announcements(lang, kind, created_at DESC);

-- Track language on radio_schedule announcements (so RadioLive can filter by user language)
ALTER TABLE public.radio_schedule
  ADD COLUMN IF NOT EXISTS lang text;

CREATE INDEX IF NOT EXISTS idx_radio_schedule_lang
  ON public.radio_schedule(lang) WHERE lang IS NOT NULL;