import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Music, Plus, Sparkles, Check, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TrackRow } from "@/components/cards/TrackRow";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Track } from "@/contexts/PlayerContext";


const gradients = [
  "from-purple-400 to-pink-500",
  "from-blue-400 to-cyan-500",
  "from-green-400 to-emerald-500",
  "from-yellow-400 to-orange-500",
  "from-red-400 to-pink-500",
  "from-indigo-400 to-purple-500",
];

const CreatePlaylist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGradient, setSelectedGradient] = useState(gradients[0]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const loadTracks = async () => {
      const { data } = await supabase
        .from("tracks")
        .select("*")
        .order("title", { ascending: true });

      setAllTracks(data || []);
    };

    loadTracks();
  }, [user, navigate]);

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-playlist", {
        body: {
          action: "generate_playlist",
          mood: "energetic",
          genre: "electronic",
          context: "Generate a creative playlist for the user",
        },
      });

      if (error) throw error;

      if (data?.data) {
        setTitle(data.data.playlistName || "AI Generated Mix");
        setDescription(data.data.description || "AI curated playlist");
        toast.success("AI generated playlist details!");
      }
    } catch (error) {
      console.error("AI generation error:", error);
      toast.error("Failed to generate AI playlist");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a playlist name");
      return;
    }

    setLoading(true);
    try {
      // Create playlist
      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .insert({
          user_id: user!.id,
          title,
          description,
          gradient: selectedGradient,
          is_ai_generated: false,
        })
        .select()
        .single();

      if (playlistError) throw playlistError;

      // Add tracks to playlist
      if (selectedTracks.length > 0) {
        const trackInserts = selectedTracks.map((trackId, index) => ({
          playlist_id: playlist.id,
          track_id: trackId,
          position: index,
        }));

        const { error: tracksError } = await supabase
          .from("playlist_tracks")
          .insert(trackInserts);

        if (tracksError) throw tracksError;
      }

      toast.success("Playlist created!");
      navigate("/library");
    } catch (error) {
      console.error("Create playlist error:", error);
      toast.error("Failed to create playlist");
    } finally {
      setLoading(false);
    }
  };

  const toggleTrack = (trackId: string) => {
    setSelectedTracks((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  return (
    <MainLayout>
      <div className="px-6 py-8 max-w-4xl mx-auto">
        <h1 className="font-display text-3xl font-bold mb-8">Create Playlist</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Details */}
          <div className="space-y-6">
            {/* Cover Preview */}
            <div className="flex justify-center">
              <motion.div
                className={`w-48 h-48 rounded-xl bg-gradient-to-br ${selectedGradient} flex items-center justify-center shadow-2xl`}
                whileHover={{ scale: 1.02 }}
              >
                <Music className="h-20 w-20 text-white/80" />
              </motion.div>
            </div>

            {/* Gradient Selector */}
            <div>
              <Label className="mb-2 block">Cover Color</Label>
              <div className="flex gap-2 flex-wrap">
                {gradients.map((gradient) => (
                  <button
                    key={gradient}
                    onClick={() => setSelectedGradient(gradient)}
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} transition-transform ${
                      selectedGradient === gradient
                        ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110"
                        : "hover:scale-105"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="title">Playlist Name</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Playlist"
                className="mt-2"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this playlist about?"
                className="mt-2"
                rows={3}
              />
            </div>

            {/* AI Generate Button */}
            <Button
              onClick={handleAIGenerate}
              variant="outline"
              disabled={aiGenerating}
              className="w-full gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {aiGenerating ? "Generating..." : "Generate with AI"}
            </Button>

            {/* Create Button */}
            <Button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="w-full groove-gradient-bg text-primary-foreground hover:opacity-90"
            >
              {loading ? "Creating..." : "Create Playlist"}
            </Button>
          </div>

          {/* Right Column - Track Selection */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Add Tracks ({selectedTracks.length} selected)</Label>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto groove-scrollbar pr-2">
              {allTracks.map((track) => (
                <motion.button
                  key={track.id}
                  onClick={() => toggleTrack(track.id)}
                  whileHover={{ x: 2 }}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    selectedTracks.includes(track.id)
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-secondary/50 hover:bg-secondary"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      selectedTracks.includes(track.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {selectedTracks.includes(track.id) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreatePlaylist;
