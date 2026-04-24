
-- Fix: view ma respektować RLS pytającego (security_invoker)
ALTER VIEW public.aurora_niche_n8n_summary SET (security_invoker = on);
