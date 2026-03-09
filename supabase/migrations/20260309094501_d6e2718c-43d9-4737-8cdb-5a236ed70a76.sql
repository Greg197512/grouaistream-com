
-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'pro', 'ultimate');

-- Create subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own subscription (on first login)
CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage subscriptions"
  ON public.user_subscriptions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can update own subscription
CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-create free subscription when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, status)
  VALUES (NEW.user_id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_subscription
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_subscription();
