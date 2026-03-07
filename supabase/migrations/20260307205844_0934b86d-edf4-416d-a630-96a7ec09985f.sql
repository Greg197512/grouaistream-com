
-- Radio station configuration
CREATE TABLE public.radio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT '24h', -- '24h' or 'scheduled'
  start_time time DEFAULT NULL,
  end_time time DEFAULT NULL,
  started_at timestamptz DEFAULT NULL,
  station_name text NOT NULL DEFAULT 'GrouaRadio Live',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view radio config" ON public.radio_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage radio config" ON public.radio_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default config
INSERT INTO public.radio_config (station_name, mode) VALUES ('GrouaRadio Live', '24h');

-- Radio schedule (ordered tracks)
CREATE TABLE public.radio_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.radio_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view radio schedule" ON public.radio_schedule FOR SELECT USING (true);
CREATE POLICY "Admins can manage radio schedule" ON public.radio_schedule FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
