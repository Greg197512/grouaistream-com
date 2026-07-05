-- Auto-append newly uploaded tracks to radio schedule
CREATE OR REPLACE FUNCTION public.auto_add_track_to_radio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_pos int;
BEGIN
  IF NEW.audio_url IS NULL OR NEW.duration IS NULL OR NEW.duration < 90 THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(position), 0) + 1 INTO next_pos FROM public.radio_schedule;
  INSERT INTO public.radio_schedule (track_id, position, item_type, custom_title, custom_duration)
  VALUES (NEW.id, next_pos, 'track', '🆕 ' || COALESCE(NEW.title,'New track'), NEW.duration);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_track_to_radio ON public.tracks;
CREATE TRIGGER trg_auto_add_track_to_radio
AFTER INSERT ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.auto_add_track_to_radio();

-- Backfill: append 500 shuffled diverse tracks so the radio plays REAL music, not just voices/ads
WITH pool AS (
  SELECT id, title, duration
  FROM public.tracks
  WHERE audio_url IS NOT NULL
    AND COALESCE(duration, 0) >= 120
  ORDER BY random()
  LIMIT 500
),
maxp AS (SELECT COALESCE(MAX(position),0) AS p FROM public.radio_schedule),
numbered AS (
  SELECT id, title, duration, ROW_NUMBER() OVER () AS rn FROM pool
)
INSERT INTO public.radio_schedule (track_id, position, item_type, custom_title, custom_duration)
SELECT n.id,
       (SELECT p FROM maxp) + n.rn,
       'track',
       COALESCE(n.title, 'Track'),
       COALESCE(n.duration, 180)
FROM numbered n;