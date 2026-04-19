-- Tabela do przechowywania automatycznie generowanych historii artystów (rolki TikTok/Shorts)
CREATE TABLE public.tiktok_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name TEXT NOT NULL,
  era TEXT,
  genre TEXT,
  hook TEXT NOT NULL,
  script TEXT NOT NULL,
  outro TEXT NOT NULL DEFAULT 'GrouaRock — matka, GrouAIStream — dziecko. Słuchaj na grouaistream.com',
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  audio_url TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  captions JSONB NOT NULL DEFAULT '[]'::jsonb,
  voice_id TEXT NOT NULL DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  published_youtube_at TIMESTAMPTZ,
  youtube_video_id TEXT,
  views_estimate INTEGER NOT NULL DEFAULT 0,
  generated_by_ai BOOLEAN NOT NULL DEFAULT true,
  blog_post_id UUID REFERENCES public.seo_blog_posts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiktok_stories_status ON public.tiktok_stories(status, created_at DESC);
CREATE INDEX idx_tiktok_stories_published ON public.tiktok_stories(published_youtube_at DESC NULLS LAST);

ALTER TABLE public.tiktok_stories ENABLE ROW LEVEL SECURITY;

-- Wszyscy zalogowani mogą oglądać (publiczne historie)
CREATE POLICY "Anyone can view tiktok stories"
ON public.tiktok_stories FOR SELECT
USING (true);

-- Tylko admini mogą zarządzać
CREATE POLICY "Admins manage tiktok stories"
ON public.tiktok_stories FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tiktok_stories_updated
BEFORE UPDATE ON public.tiktok_stories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lista legendarnych artystów do losowania (seed)
CREATE TABLE public.tiktok_artists_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  era TEXT,
  genre TEXT,
  story_hook TEXT,
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tiktok_artists_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read artists pool"
ON public.tiktok_artists_pool FOR SELECT USING (true);

CREATE POLICY "Admins manage artists pool"
ON public.tiktok_artists_pool FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed legendarnych artystów
INSERT INTO public.tiktok_artists_pool (name, era, genre, story_hook) VALUES
('Freddie Mercury', '1970-1991', 'Rock', 'Głos który łamał szkło i serca'),
('Michael Jackson', '1970-2009', 'Pop', 'Król popu i moonwalk który zmienił świat'),
('David Bowie', '1960-2016', 'Rock', 'Człowiek który spadł z gwiazd'),
('Whitney Houston', '1980-2012', 'R&B', 'Głos pokolenia, tragedia w cieniu sławy'),
('Prince', '1970-2016', 'Funk', 'Geniusz w purpurze, 5 oktaw, 39 albumów'),
('Amy Winehouse', '2000-2011', 'Soul', 'Tatuaże, ulik i głos który bolał'),
('Kurt Cobain', '1980-1994', 'Grunge', 'Antybohater który nie chciał być bogiem'),
('John Lennon', '1960-1980', 'Rock', 'Imagine — pieśń która zmieniła pokolenie'),
('Bob Marley', '1960-1981', 'Reggae', 'Reggae prorok który zatrzymał wojnę'),
('Janis Joplin', '1960-1970', 'Blues Rock', '27 lat, blues w gardle, whisky w żyłach'),
('Jimi Hendrix', '1960-1970', 'Rock', 'Gitara w płomieniach i palce z innego wymiaru'),
('Elvis Presley', '1950-1977', 'Rock and Roll', 'Król który stworzył rock and roll'),
('Aretha Franklin', '1950-2018', 'Soul', 'Królowa soulu — R-E-S-P-E-C-T'),
('Tupac Shakur', '1990-1996', 'Hip-Hop', 'Poeta z ulicy, ikona która nie umarła'),
('The Notorious B.I.G.', '1990-1997', 'Hip-Hop', '24 lata, dwa albumy, legenda na zawsze'),
('Bob Dylan', '1960-', 'Folk', 'Głos pokolenia który dostał Nobla'),
('Stevie Wonder', '1960-', 'Soul', 'Niewidomy geniusz z 25 Grammy'),
('Madonna', '1980-', 'Pop', 'Materialna dziewczyna która reinventowała pop 7 razy'),
('Beyoncé', '1990-', 'R&B', 'Queen Bey i Beyhive — siła kobiecości'),
('Lady Gaga', '2000-', 'Pop', 'Born this way — od dziwactwa do ikony');