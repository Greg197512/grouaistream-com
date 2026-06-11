
-- Revoke anon privileges on sensitive tables (Postgres default-deny + explicit revoke).
REVOKE ALL ON public.ad_campaigns FROM anon;
REVOKE ALL ON public.aurora_crm_clients FROM anon;
REVOKE ALL ON public.aurora_desktop_emotions FROM anon;
REVOKE ALL ON public.aurora_desktop_sync FROM anon;
REVOKE ALL ON public.aurora_partner_companies FROM anon;
REVOKE ALL ON public.aurora_storage_offers FROM anon;
REVOKE ALL ON public.aurora_storage_subscriptions FROM anon;
REVOKE ALL ON public.aurora_invoices FROM anon;
REVOKE ALL ON public.blog_newsletter_subscribers FROM anon;

-- Add explicit deny-anon SELECT policies so the intent is unambiguous to scanners.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ad_campaigns','aurora_crm_clients','aurora_desktop_emotions',
    'aurora_desktop_sync','aurora_partner_companies','aurora_storage_offers',
    'aurora_storage_subscriptions','aurora_invoices','blog_newsletter_subscribers'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Deny anon read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Deny anon read" ON public.%I AS RESTRICTIVE FOR SELECT TO anon USING (false)',
      t
    );
  END LOOP;
END $$;
