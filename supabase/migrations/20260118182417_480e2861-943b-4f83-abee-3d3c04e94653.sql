-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tracks table for music library
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration INTEGER NOT NULL DEFAULT 180,
  audio_url TEXT,
  cover_url TEXT,
  genre TEXT,
  mood TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlists table
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  gradient TEXT DEFAULT 'from-purple-400 to-pink-500',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playlist_tracks junction table
CREATE TABLE public.playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(playlist_id, track_id)
);

-- Create liked_songs table
CREATE TABLE public.liked_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_id)
);

-- Create listening_history table for AI personalization
CREATE TABLE public.listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  duration_played INTEGER DEFAULT 0,
  skipped BOOLEAN DEFAULT false,
  mood_detected TEXT
);

-- Create mood_sessions table for AI mood tracking
CREATE TABLE public.mood_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  confidence NUMERIC(5,2) DEFAULT 0,
  source TEXT DEFAULT 'manual',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tracks policies (public read, admin write)
CREATE POLICY "Anyone can view tracks" ON public.tracks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tracks" ON public.tracks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Playlists policies
CREATE POLICY "Anyone can view public playlists" ON public.playlists
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert playlists" ON public.playlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists" ON public.playlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists" ON public.playlists
  FOR DELETE USING (auth.uid() = user_id);

-- Playlist tracks policies
CREATE POLICY "Anyone can view playlist tracks of public playlists" ON public.playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_tracks.playlist_id 
      AND (playlists.is_public = true OR playlists.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own playlist tracks" ON public.playlist_tracks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.playlists 
      WHERE playlists.id = playlist_tracks.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

-- Liked songs policies
CREATE POLICY "Users can view own liked songs" ON public.liked_songs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own liked songs" ON public.liked_songs
  FOR ALL USING (auth.uid() = user_id);

-- Listening history policies
CREATE POLICY "Users can view own listening history" ON public.listening_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own listening history" ON public.listening_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Mood sessions policies
CREATE POLICY "Users can view own mood sessions" ON public.mood_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own mood sessions" ON public.mood_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample tracks for demo
INSERT INTO public.tracks (title, artist, album, duration, genre, mood, audio_url) VALUES
('Midnight Dreams', 'Aurora Beats', 'Neon Horizons', 234, 'Electronic', 'relaxed', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'),
('Electric Soul', 'Neon Wave', 'Synth City', 198, 'Synthwave', 'energetic', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'),
('Sunset Boulevard', 'The Groove Masters', 'Golden Hour', 267, 'Chill', 'relaxed', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'),
('Digital Love', 'Synthia', 'Future Hearts', 215, 'Electronic', 'happy', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'),
('Cloud Nine', 'Sky Walker', 'Dreamscape', 245, 'Ambient', 'relaxed', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'),
('Rhythm Divine', 'Beat Collective', 'Dance Floor', 189, 'Dance', 'energetic', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'),
('Morning Light', 'Dawn Chorus', 'New Day', 203, 'Acoustic', 'happy', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'),
('Focus Flow', 'Mind Stream', 'Concentration', 312, 'Lo-Fi', 'focused', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'),
('Night Drive', 'Retro Wave', '80s Revival', 256, 'Synthwave', 'energetic', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'),
('Ocean Waves', 'Coastal Vibes', 'Beach Life', 278, 'Chill', 'relaxed', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'),
('Urban Jungle', 'City Beats', 'Metro Life', 192, 'Hip-Hop', 'energetic', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3'),
('Starlight Serenade', 'Cosmos', 'Galaxy Dreams', 289, 'Ambient', 'relaxed', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3');