GRANT SELECT ON TABLE public.tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tracks TO authenticated;
GRANT ALL ON TABLE public.tracks TO service_role;