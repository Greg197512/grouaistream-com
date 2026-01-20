import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Play, Shuffle } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { TrackRow } from "@/components/cards/TrackRow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface LikedSong {
  id: string;
  liked_at: string;
  tracks: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    duration: number;
    audio_url: string | null;
    video_url: string | null;
    cover_url: string | null;
    genre: string | null;
    mood: string | null;
  };
}

const LikedSongs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playPlaylist, currentTrack, isPlaying, togglePlay, toggleShuffle } = usePlayer();
  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const loadLikedSongs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("liked_songs")
        .select(`
          id,
          liked_at,
          tracks (
            id,
            title,
            artist,
            album,
            duration,
            audio_url,
            video_url,
            cover_url,
            genre,
            mood
          )
        `)
        .eq("user_id", user.id)
        .order("liked_at", { ascending: false });

      if (error) {
        console.error("Error loading liked songs:", error);
      } else {
        setLikedSongs(data as unknown as LikedSong[] || []);
      }
      setLoading(false);
    };

    loadLikedSongs();
  }, [user, navigate]);

  const tracks: Track[] = likedSongs
    .filter(ls => ls.tracks)
    .map(ls => ({
      id: ls.tracks.id,
      title: ls.tracks.title,
      artist: ls.tracks.artist,
      album: ls.tracks.album,
      duration: ls.tracks.duration,
      audio_url: ls.tracks.audio_url,
      video_url: ls.tracks.video_url,
      cover_url: ls.tracks.cover_url,
      genre: ls.tracks.genre,
      mood: ls.tracks.mood,
    }));

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playPlaylist(tracks);
    }
  };

  const handleShufflePlay = () => {
    if (tracks.length > 0) {
      toggleShuffle();
      playPlaylist(tracks);
    }
  };

  const handlePlayTrack = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playPlaylist(tracks, index);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-xl groove-gradient-bg flex items-center justify-center shadow-2xl"
          >
            <Heart className="h-24 w-24 text-primary-foreground fill-primary-foreground" />
          </motion.div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">Playlist</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">Liked Songs</h1>
            <p className="text-muted-foreground">{tracks.length} songs</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={handlePlayAll}
            size="lg"
            className="groove-gradient-bg text-primary-foreground hover:opacity-90 gap-2 rounded-full h-14 px-8"
            disabled={tracks.length === 0}
          >
            <Play className="h-5 w-5 fill-current" />
            Play
          </Button>
          <Button
            onClick={handleShufflePlay}
            size="lg"
            variant="outline"
            className="gap-2 rounded-full h-14 px-8"
            disabled={tracks.length === 0}
          >
            <Shuffle className="h-5 w-5" />
            Shuffle
          </Button>
        </div>

        {/* Track List */}
        {tracks.length > 0 ? (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                index={index + 1}
                title={track.title}
                artist={track.artist}
                album={track.album || ""}
                duration={formatDuration(track.duration)}
                imageUrl={track.cover_url || undefined}
                isPlaying={currentTrack?.id === track.id && isPlaying}
                onPlay={() => handlePlayTrack(track, index)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No liked songs yet. Start exploring and like some tracks!</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default LikedSongs;
