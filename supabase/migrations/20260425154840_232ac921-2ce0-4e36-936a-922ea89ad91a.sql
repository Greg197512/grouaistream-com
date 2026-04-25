
ALTER TABLE public.radio_config 
ADD COLUMN IF NOT EXISTS blog_announcements_enabled boolean NOT NULL DEFAULT false;
