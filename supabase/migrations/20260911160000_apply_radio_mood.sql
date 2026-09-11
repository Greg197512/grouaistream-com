-- Inteligentny tryb radia bez n8n: jedna funkcja SQL dobiera ~60 utworów do
-- nastroju (chill/energetic/focus/party) po cechach audio (energy/valence/
-- danceability/bpm) + gatunkach, z fallbackiem (COALESCE + random), podmienia
-- stację 'public' i RESETUJE started_at — radio dostosowuje się OD RAZU.
-- Klient (RadioMoodSwitcher) woła rpc('apply_radio_mood'); RadioLive nasłuchuje
-- zmian radio_config i przeładowuje grafik u wszystkich słuchaczy.

CREATE OR REPLACE FUNCTION public.apply_radio_mood(_mood text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','moderator')) THEN
    RAISE EXCEPTION 'admin/moderator only';
  END IF;
  IF _mood NOT IN ('chill','energetic','focus','party') THEN
    RAISE EXCEPTION 'invalid mood';
  END IF;

  DELETE FROM public.radio_schedule WHERE item_type = 'track' AND station = 'public';

  INSERT INTO public.radio_schedule (track_id, item_type, position, station)
  SELECT id, 'track', rn, 'public'
  FROM (
    SELECT id, row_number() OVER (ORDER BY score DESC) AS rn
    FROM (
      SELECT t.id,
        (CASE _mood
          WHEN 'energetic' THEN 2*COALESCE(t.energy,0.5) + COALESCE(t.danceability,0.5) + COALESCE(t.bpm,110)/200.0
               + (CASE WHEN t.genre ~* 'rock|edm|electro|hip.?hop|rap|metal|punk|dance|techno|house' THEN 1.2 ELSE 0 END)
          WHEN 'party' THEN 2*COALESCE(t.danceability,0.5) + COALESCE(t.energy,0.5) + COALESCE(t.valence,0.5)
               + (CASE WHEN t.genre ~* 'dance|house|pop|disco|edm|hip.?hop|funk|techno' THEN 1.2 ELSE 0 END)
          WHEN 'chill' THEN 2*(1-COALESCE(t.energy,0.5)) + (1-COALESCE(t.danceability,0.5))
               + (CASE WHEN t.genre ~* 'ambient|lo.?fi|acoustic|jazz|folk|chill|soul|r&b|indie|classical' THEN 1.2 ELSE 0 END)
          ELSE (1-COALESCE(t.energy,0.5)) + 0.5*(1-COALESCE(t.valence,0.5))
               + (CASE WHEN t.genre ~* 'lo.?fi|ambient|classical|instrumental|post.?rock|electro|piano' THEN 1.2 ELSE 0 END)
        END) + random()*0.4 AS score
      FROM public.tracks t
      WHERE (t.audio_url IS NOT NULL OR t.video_url IS NOT NULL) AND t.locked = false
    ) scored
  ) ranked
  WHERE rn <= 60;

  UPDATE public.radio_config
    SET mode = 'mood:'||_mood, is_active = true, started_at = now(),
        current_schedule_id = NULL, updated_at = now();

  SELECT count(*) INTO n FROM public.radio_schedule WHERE station='public' AND item_type='track';
  RETURN jsonb_build_object('ok', true, 'mood', _mood, 'count', n);
END $$;

GRANT EXECUTE ON FUNCTION public.apply_radio_mood(text) TO authenticated;
