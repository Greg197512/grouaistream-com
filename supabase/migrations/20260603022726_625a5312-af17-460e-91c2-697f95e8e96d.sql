CREATE OR REPLACE FUNCTION public.set_radio_current_schedule(_schedule_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.radio_config
  SET current_schedule_id = _schedule_id,
      updated_at = now()
  WHERE is_active = true
    AND (
      _schedule_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.radio_schedule
        WHERE id = _schedule_id
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.set_radio_current_schedule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_radio_current_schedule(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_radio_current_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_radio_current_schedule(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';