
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT 
        u.id,
        u.email,
        u.created_at,
        u.last_sign_in_at,
        p.display_name
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      ORDER BY u.created_at DESC
    ) t
  );
END;
$$;
