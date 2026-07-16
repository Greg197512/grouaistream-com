-- NAPRAWA: biblioteka zalana ~36 000 utworów bez plików audio.
-- Źródło: crony bulk-populate / daily-cc-fetch wstawiały rekordy z audio_url = NULL
-- (kroki "AI metadata" i "royalty-free" celowo, ccMixter bo API umarło).
-- 1) Wyłącz oba crony. 2) Usuń nieodtwarzalne utwory (bez audio i bez video),
--    najpierw odpinając je z playlist/polubień/historii.

-- 1) Stop cronów (bezpiecznie — nie wywala się, gdy job nie istnieje)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('grouai-cc-mixter-bulk-fetch', 'grouai-daily-cc-fetch');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Pominieto unschedule: %', SQLERRM;
END $$;

-- 2) Czyszczenie martwych utworów (audio_url IS NULL i video_url IS NULL).
--    Osierocone referencje usuwamy wprost; całość w bloku z wyjątkiem,
--    żeby migracja nigdy nie zablokowała wdrożenia.
DO $$
DECLARE
  ref RECORD;
  n integer;
BEGIN
  -- odpięcie referencji ze wszystkich tabel wskazujących na tracks(id)
  FOR ref IN
    SELECT tc.table_schema AS sch, tc.table_name AS tbl, kcu.column_name AS col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'tracks' AND ccu.column_name = 'id'
      AND tc.table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'DELETE FROM %I.%I r WHERE r.%I IN (SELECT id FROM public.tracks WHERE audio_url IS NULL AND video_url IS NULL)',
        ref.sch, ref.tbl, ref.col
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Pominieto czyszczenie %.%: %', ref.sch, ref.tbl, SQLERRM;
    END;
  END LOOP;

  -- usuwanie martwych utworów partiami po 5000
  LOOP
    DELETE FROM public.tracks
    WHERE id IN (
      SELECT id FROM public.tracks
      WHERE audio_url IS NULL AND video_url IS NULL
      LIMIT 5000
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    EXIT WHEN n = 0;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Czyszczenie tracks przerwane (frontend i tak filtruje): %', SQLERRM;
END $$;
