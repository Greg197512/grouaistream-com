ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NULL;

-- Set trial_ends_at to 7 days from now for all existing free users who don't have it
UPDATE public.user_subscriptions 
SET trial_ends_at = created_at + interval '7 days'
WHERE trial_ends_at IS NULL;