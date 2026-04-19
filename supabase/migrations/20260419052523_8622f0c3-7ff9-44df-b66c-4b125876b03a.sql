-- ============================================================
-- AD OUTREACH BOT — leady firm + kampanie reklamowe na blogu
-- ============================================================

-- 1) Leady firm znalezione przez bota (n8n + Firecrawl)
CREATE TABLE public.ad_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_name text,
  website text,
  industry text,
  country text,
  source text NOT NULL DEFAULT 'firecrawl',
  status text NOT NULL DEFAULT 'new', -- new | queued | sent | bounced | replied | converted | unsubscribed | invalid
  outreach_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  contacted_at timestamptz,
  reply_received_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ad_leads_email_lower ON public.ad_leads (lower(email));
CREATE INDEX idx_ad_leads_status ON public.ad_leads (status, created_at DESC);
CREATE INDEX idx_ad_leads_token ON public.ad_leads (outreach_token);

ALTER TABLE public.ad_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ad_leads"
  ON public.ad_leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages ad_leads"
  ON public.ad_leads FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_ad_leads_updated_at
  BEFORE UPDATE ON public.ad_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Reklamy wysłane przez firmy (po kliknięciu CTA z emaila)
CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.ad_leads(id) ON DELETE SET NULL,
  blog_post_id uuid REFERENCES public.seo_blog_posts(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  ad_title text NOT NULL,
  ad_description text NOT NULL,
  ad_url text NOT NULL,
  ad_image_url text,
  industry text,
  amount_eur numeric NOT NULL DEFAULT 10,
  payment_status text NOT NULL DEFAULT 'pending', -- pending | confirmed | rejected | expired
  payment_confirmed_at timestamptz,
  payment_confirmed_by uuid,
  payment_reference text,
  publish_status text NOT NULL DEFAULT 'live', -- live | paused | removed
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  payment_deadline timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_campaigns_status ON public.ad_campaigns (payment_status, publish_status);
CREATE INDEX idx_ad_campaigns_lead ON public.ad_campaigns (lead_id);
CREATE INDEX idx_ad_campaigns_active ON public.ad_campaigns (expires_at) WHERE publish_status = 'live';

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ad_campaigns"
  ON public.ad_campaigns FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages ad_campaigns"
  ON public.ad_campaigns FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Public reads live confirmed campaigns"
  ON public.ad_campaigns FOR SELECT
  TO anon, authenticated
  USING (
    publish_status = 'live'
    AND expires_at > now()
    AND (payment_status = 'confirmed' OR (payment_status = 'pending' AND payment_deadline > now()))
  );

CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) RPC: limit 20 maili/dzień
CREATE OR REPLACE FUNCTION public.ad_outreach_daily_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.ad_leads
  WHERE contacted_at >= date_trunc('day', now());
$$;

-- 4) RPC: confirm payment (admin)
CREATE OR REPLACE FUNCTION public.admin_confirm_ad_payment(_campaign_id uuid, _reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _lead_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.ad_campaigns
  SET payment_status = 'confirmed',
      payment_confirmed_at = now(),
      payment_confirmed_by = auth.uid(),
      payment_reference = _reference,
      publish_status = 'live',
      expires_at = now() + interval '30 days'
  WHERE id = _campaign_id
  RETURNING lead_id INTO _lead_id;

  IF _lead_id IS NOT NULL THEN
    UPDATE public.ad_leads SET status = 'converted' WHERE id = _lead_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5) RPC: reject / remove (admin)
CREATE OR REPLACE FUNCTION public.admin_remove_ad_campaign(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  UPDATE public.ad_campaigns
  SET publish_status = 'removed',
      payment_status = CASE WHEN payment_status = 'pending' THEN 'rejected' ELSE payment_status END
  WHERE id = _campaign_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6) RPC: auto-expire unpaid campaigns (called by n8n co 1h)
CREATE OR REPLACE FUNCTION public.expire_unpaid_ad_campaigns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  UPDATE public.ad_campaigns
  SET publish_status = 'removed',
      payment_status = 'expired'
  WHERE payment_status = 'pending'
    AND payment_deadline < now()
    AND publish_status = 'live';

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;