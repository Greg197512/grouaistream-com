-- Helper to pick a random monetized track owner (for rotating coffee-tip recipients on homepage)
CREATE OR REPLACE FUNCTION public.get_random_tippable_track()
RETURNS TABLE(track_id uuid, owner_user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.user_id
  FROM public.tracks t
  WHERE t.user_id IS NOT NULL
    AND t.is_monetized = true
  ORDER BY random()
  LIMIT 1;
$$;

-- Allow service role to read tracks freely (already does via service key, but make function callable)
GRANT EXECUTE ON FUNCTION public.get_random_tippable_track() TO anon, authenticated, service_role;

-- Index to speed up env-filtered subscription lookup from the frontend
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_env_status
  ON public.subscriptions(user_id, environment, status);