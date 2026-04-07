
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('stream_events','party_rooms','party_commands','dj_sessions','dj_session_guests','dj_session_votes')
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', tbl);
  END LOOP;
END $$;
