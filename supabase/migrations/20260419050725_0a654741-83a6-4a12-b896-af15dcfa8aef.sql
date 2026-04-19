
-- Hooks per blog post
CREATE TABLE public.blog_post_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.seo_blog_posts(id) ON DELETE CASCADE,
  x_hook text,
  telegram_hook text,
  email_hook text,
  email_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id)
);

ALTER TABLE public.blog_post_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads hooks of published posts"
ON public.blog_post_hooks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.seo_blog_posts p
  WHERE p.id = blog_post_hooks.post_id AND (p.is_published = true OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Admins manage hooks"
ON public.blog_post_hooks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role inserts hooks"
ON public.blog_post_hooks FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Newsletter dispatch log
CREATE TABLE public.blog_newsletter_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.seo_blog_posts(id) ON DELETE SET NULL,
  triggered_by uuid,
  recipients_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_newsletter_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read newsletter log"
ON public.blog_newsletter_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages newsletter log"
ON public.blog_newsletter_log FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Optional: opt-out flag on profiles for blog newsletter
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blog_newsletter_opt_out boolean NOT NULL DEFAULT false;
