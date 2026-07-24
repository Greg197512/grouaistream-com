
-- aurora_metric_events: restrict public inserts to view/click only
DROP POLICY IF EXISTS "metrics anyone insert" ON public.aurora_metric_events;
CREATE POLICY "metrics public insert view/click only"
  ON public.aurora_metric_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (event_type IN ('view','click'));

-- dj_session_guests: restrict SELECT
DROP POLICY IF EXISTS "Anyone can view session guests" ON public.dj_session_guests;
CREATE POLICY "Guests visible to host and session participants"
  ON public.dj_session_guests FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR EXISTS (SELECT 1 FROM public.dj_sessions s WHERE s.id = dj_session_guests.session_id AND s.host_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.dj_session_guests g2 WHERE g2.session_id = dj_session_guests.session_id AND g2.user_id = auth.uid())
  );

-- dj_session_votes: require valid guest, restrict SELECT
DROP POLICY IF EXISTS "Anyone can vote" ON public.dj_session_votes;
CREATE POLICY "Only registered guests can vote"
  ON public.dj_session_votes FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dj_session_guests g
      WHERE g.id = dj_session_votes.guest_id
        AND g.session_id = dj_session_votes.session_id
    )
  );

DROP POLICY IF EXISTS "Anyone can view session votes" ON public.dj_session_votes;
CREATE POLICY "Votes visible to host and session guests"
  ON public.dj_session_votes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.dj_sessions s WHERE s.id = dj_session_votes.session_id AND s.host_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.dj_session_guests g WHERE g.session_id = dj_session_votes.session_id AND g.user_id = auth.uid())
  );

-- party_commands: require authenticated user and active room
DROP POLICY IF EXISTS "Anyone can insert commands" ON public.party_commands;
CREATE POLICY "Authenticated users can insert into active rooms"
  ON public.party_commands FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.party_rooms r WHERE r.id = party_commands.room_id AND r.is_active = true)
  );

DROP POLICY IF EXISTS "Anyone can view commands" ON public.party_commands;
CREATE POLICY "Host and authenticated users can view commands"
  ON public.party_commands FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.party_rooms r WHERE r.id = party_commands.room_id AND (r.is_active = true OR r.host_user_id = auth.uid()))
  );

-- radio_likes: only see own likes
DROP POLICY IF EXISTS "Authenticated users can view radio likes" ON public.radio_likes;
CREATE POLICY "Users can view their own likes"
  ON public.radio_likes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
