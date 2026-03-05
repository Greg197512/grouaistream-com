
CREATE TABLE public.unlock_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.unlock_codes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage codes
CREATE POLICY "Admins can manage unlock codes" ON public.unlock_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can check codes (needed for unlock verification)
CREATE POLICY "Anyone can read active codes" ON public.unlock_codes
  FOR SELECT
  USING (is_active = true);

-- Insert default code
INSERT INTO public.unlock_codes (code, label) VALUES ('222005', 'Domyślny kod');
