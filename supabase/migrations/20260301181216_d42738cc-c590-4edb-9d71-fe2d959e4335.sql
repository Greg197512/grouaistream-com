
CREATE TABLE public.ai_assistant_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  assistant_name text NOT NULL DEFAULT 'Groove',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own config" ON public.ai_assistant_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.ai_assistant_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.ai_assistant_config FOR UPDATE USING (auth.uid() = user_id);
