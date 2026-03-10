
CREATE TABLE public.dj_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  session_code text NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  session_name text NOT NULL DEFAULT 'Rotterdam Peak-Time',
  genre text DEFAULT 'Electronic',
  bpm integer DEFAULT 131,
  is_active boolean NOT NULL DEFAULT true,
  max_guests integer DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dj_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sessions" ON public.dj_sessions
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Host can manage own sessions" ON public.dj_sessions
  FOR ALL TO authenticated USING (auth.uid() = host_user_id);

CREATE TABLE public.dj_session_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.dj_sessions(id) ON DELETE CASCADE,
  user_id uuid,
  guest_name text DEFAULT 'Anonim',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_reaction text,
  last_reaction_at timestamptz
);

ALTER TABLE public.dj_session_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view session guests" ON public.dj_session_guests
  FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can join sessions" ON public.dj_session_guests
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Guests can update own record" ON public.dj_session_guests
  FOR UPDATE TO public USING (
    (user_id IS NOT NULL AND auth.uid() = user_id) OR user_id IS NULL
  );

CREATE TABLE public.dj_session_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.dj_sessions(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.dj_session_guests(id) ON DELETE CASCADE,
  vote_type text NOT NULL DEFAULT 'genre_request',
  vote_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dj_session_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view session votes" ON public.dj_session_votes
  FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can vote" ON public.dj_session_votes
  FOR INSERT TO public WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dj_session_guests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dj_session_votes;
