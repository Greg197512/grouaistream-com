-- Add multi-language columns to blog posts
ALTER TABLE public.seo_blog_posts
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_nl text,
  ADD COLUMN IF NOT EXISTS title_ua text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_nl text,
  ADD COLUMN IF NOT EXISTS description_ua text,
  ADD COLUMN IF NOT EXISTS content_en text,
  ADD COLUMN IF NOT EXISTS content_nl text,
  ADD COLUMN IF NOT EXISTS content_ua text,
  ADD COLUMN IF NOT EXISTS translations_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS translation_status text DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_blog_translation_status ON public.seo_blog_posts(translation_status, is_published);

-- Trigger function: enqueue translation when post inserted/updated (PL changes)
CREATE OR REPLACE FUNCTION public.enqueue_blog_translation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  needs_translation boolean := false;
BEGIN
  -- On insert: always translate
  IF TG_OP = 'INSERT' THEN
    needs_translation := NEW.is_published;
  -- On update: only if PL content changed OR was just published
  ELSIF TG_OP = 'UPDATE' THEN
    needs_translation := NEW.is_published AND (
      OLD.title IS DISTINCT FROM NEW.title OR
      OLD.description IS DISTINCT FROM NEW.description OR
      OLD.content IS DISTINCT FROM NEW.content OR
      (OLD.is_published = false AND NEW.is_published = true)
    );
  END IF;

  IF needs_translation THEN
    NEW.translation_status := 'pending';
    -- Fire-and-forget HTTP call to edge function
    PERFORM net.http_post(
      url := 'https://bvstvawnigyczvofzhps.supabase.co/functions/v1/blog-translate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('post_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_blog_translation ON public.seo_blog_posts;
CREATE TRIGGER trg_enqueue_blog_translation
  BEFORE INSERT OR UPDATE ON public.seo_blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_blog_translation();