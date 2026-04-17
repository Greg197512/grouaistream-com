ALTER TABLE public.admin_marquee_messages 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes');

CREATE INDEX IF NOT EXISTS idx_admin_marquee_active_expires 
ON public.admin_marquee_messages (is_active, expires_at);