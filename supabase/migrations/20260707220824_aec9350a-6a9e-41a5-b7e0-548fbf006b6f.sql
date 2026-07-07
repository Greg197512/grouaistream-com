
UPDATE public.profiles
SET role = 'pro', subscription_status = 'pro', updated_at = now()
WHERE user_id = 'bfaecabe-2815-4ba5-be43-131d26952c4d';

UPDATE public.user_subscriptions
SET plan = 'pro', status = 'active', updated_at = now()
WHERE user_id = 'bfaecabe-2815-4ba5-be43-131d26952c4d';
