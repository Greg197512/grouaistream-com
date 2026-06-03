
ALTER TABLE public.radio_config
ADD COLUMN IF NOT EXISTS current_schedule_id uuid REFERENCES public.radio_schedule(id) ON DELETE SET NULL;
