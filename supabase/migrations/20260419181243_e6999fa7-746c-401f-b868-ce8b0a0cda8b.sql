CREATE OR REPLACE FUNCTION public.get_user_audio_fingerprint()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _result jsonb;
  _top_track_ids uuid[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Top 10 utworów (po liczbie odsłuchań w ostatnich 90 dniach)
  SELECT array_agg(track_id) INTO _top_track_ids FROM (
    SELECT track_id, count(*) AS plays
    FROM stream_events
    WHERE user_id = _user_id
      AND counted = true
      AND streamed_at > now() - interval '90 days'
    GROUP BY track_id
    ORDER BY plays DESC
    LIMIT 10
  ) t;

  IF _top_track_ids IS NULL OR array_length(_top_track_ids, 1) = 0 THEN
    -- Fallback: liked songs
    SELECT array_agg(track_id) INTO _top_track_ids FROM (
      SELECT track_id FROM liked_songs
      WHERE user_id = _user_id
      ORDER BY liked_at DESC LIMIT 10
    ) t;
  END IF;

  IF _top_track_ids IS NULL OR array_length(_top_track_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'has_history', false,
      'message', 'Brak historii odsłuchań — posłuchaj kilka utworów żeby AI poznało Twój gust.'
    );
  END IF;

  -- Agregacja audio features + metadata
  WITH track_data AS (
    SELECT 
      t.id, t.title, t.artist, t.genre,
      sc.subgenre, sc.mood,
      af.bpm, af.music_key, af.energy, af.danceability, af.valence, af.acousticness
    FROM tracks t
    LEFT JOIN song_catalog sc ON sc.title = t.title AND sc.artist = t.artist
    LEFT JOIN audio_features af ON af.catalog_id = sc.id
    WHERE t.id = ANY(_top_track_ids)
  )
  SELECT jsonb_build_object(
    'has_history', true,
    'sample_size', array_length(_top_track_ids, 1),
    'avg_bpm', ROUND(AVG(bpm)::numeric, 0),
    'avg_energy', ROUND(AVG(energy)::numeric, 2),
    'avg_danceability', ROUND(AVG(danceability)::numeric, 2),
    'avg_valence', ROUND(AVG(valence)::numeric, 2),
    'avg_acousticness', ROUND(AVG(acousticness)::numeric, 2),
    'dominant_key', (SELECT music_key FROM track_data WHERE music_key IS NOT NULL GROUP BY music_key ORDER BY count(*) DESC LIMIT 1),
    'dominant_genre', (SELECT genre FROM track_data WHERE genre IS NOT NULL GROUP BY genre ORDER BY count(*) DESC LIMIT 1),
    'dominant_subgenre', (SELECT subgenre FROM track_data WHERE subgenre IS NOT NULL GROUP BY subgenre ORDER BY count(*) DESC LIMIT 1),
    'dominant_mood', (SELECT mood FROM track_data WHERE mood IS NOT NULL GROUP BY mood ORDER BY count(*) DESC LIMIT 1),
    'top_artists', (SELECT jsonb_agg(artist) FROM (SELECT artist FROM track_data WHERE artist IS NOT NULL GROUP BY artist ORDER BY count(*) DESC LIMIT 5) a),
    'sample_tracks', (SELECT jsonb_agg(jsonb_build_object('title', title, 'artist', artist)) FROM (SELECT title, artist FROM track_data LIMIT 5) s)
  ) INTO _result FROM track_data;

  RETURN COALESCE(_result, jsonb_build_object('has_history', false));
END;
$$;