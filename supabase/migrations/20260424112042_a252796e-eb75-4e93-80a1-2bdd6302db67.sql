-- Fix: ustaw widok jako security_invoker, żeby respektował RLS pytającego (admin policy na bazowych tabelach)
ALTER VIEW public.aurora_workforce_overview SET (security_invoker = true);