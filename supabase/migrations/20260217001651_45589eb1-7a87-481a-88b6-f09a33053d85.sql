
-- Create movies table
CREATE TABLE public.movies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  director TEXT NOT NULL,
  year INTEGER,
  genre TEXT,
  category TEXT NOT NULL DEFAULT 'foreign', -- 'polish' or 'foreign'
  description TEXT,
  poster_url TEXT,
  video_url TEXT,
  duration_minutes INTEGER DEFAULT 90,
  rating NUMERIC(3,1),
  country TEXT,
  language TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

-- Anyone can view movies
CREATE POLICY "Anyone can view movies" ON public.movies
  FOR SELECT USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert movies" ON public.movies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can delete
CREATE POLICY "Admins can delete movies" ON public.movies
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
