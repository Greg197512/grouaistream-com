import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDragDrop } from "@/contexts/DragDropContext";
import { Droppable } from "@hello-pangea/dnd";
import { Track } from "@/contexts/PlayerContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { WaveformPlayer } from "./WaveformPlayer";
import { mixAudioFiles, type MixStyle } from "@/utils/audioMixer";
import { NeonWavesLoader } from "./NeonWavesLoader";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, X, Blend, Music, Disc3, Save, Shuffle, Sparkles, Star, ThumbsUp, Brain } from "lucide-react";

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  audio_url: string | null;
  genre: string | null;
  duration: number;
}

interface AISuggestion {
  track_a_id: string;
  track_b_id: string;
  track_a: { id: string; title: string; artist: string; genre: string | null };
  track_b: { id: string; title: string; artist: string; genre: string | null };
  reason: string;
  mix_style: MixStyle;
  confidence: number;
}

const MIX_STYLES: { value: MixStyle; label: string; desc: string }[] = [
  { value: "crossfade", label: "Crossfade", desc: "Płynne przejście A → B" },
  { value: "overlay", label: "Overlay", desc: "Oba naraz, pełny mix" },
  { value: "mashup", label: "Mashup", desc: "Stereo blend ze stereo panningiem" },
];

export const TrackMixer = () => {
  const { user, session } = useAuth();
  const { isDragging, setOnMixerDrop } = useDragDrop();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TrackItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [trackA, setTrackA] = useState<TrackItem | null>(null);
  const [trackB, setTrackB] = useState<TrackItem | null>(null);
  const [selectingSlot, setSelectingSlot] = useState<"A" | "B" | null>(null);
  const [mixStyle, setMixStyle] = useState<MixStyle>("mashup");
  const [gainA, setGainA] = useState(85);
  const [gainB, setGainB] = useState(85);
  const [crossfadeDur, setCrossfadeDur] = useState(3);
  const [mixing, setMixing] = useState(false);
  const [mixResult, setMixResult] = useState<{ audioUrl: string; duration: number; title: string } | null>(null);

  // AI suggestions
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mixHistory, setMixHistory] = useState<any[]>([]);

  // Load mix history
  useEffect(() => {
    if (!user) return;
    supabase
      .from("mix_preferences")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setMixHistory(data || []));
  }, [user]);

  // Register mixer drop callback
  const handleMixerDrop = useCallback((slot: "A" | "B", track: Track) => {
    const item: TrackItem = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      audio_url: track.audio_url || null,
      genre: track.genre || null,
      duration: track.duration || 180,
    };
    if (slot === "A") setTrackA(item);
    else setTrackB(item);
    setMixResult(null);
  }, []);

  useEffect(() => {
    setOnMixerDrop(() => handleMixerDrop);
    return () => setOnMixerDrop(null);
  }, [handleMixerDrop, setOnMixerDrop]);

  // Search tracks from library
  useEffect(() => {
    if (!searchQuery.trim() || !selectingSlot) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const q = searchQuery.trim().toLowerCase();
        const { data } = await supabase
          .from("tracks")
          .select("id, title, artist, audio_url, genre, duration")
          .or(`title.ilike.%${q}%,artist.ilike.%${q}%,genre.ilike.%${q}%`)
          .not("audio_url", "is", null)
          .limit(20);
        setSearchResults((data as TrackItem[]) || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectingSlot]);

  const selectTrack = (track: TrackItem) => {
    if (selectingSlot === "A") setTrackA(track);
    else if (selectingSlot === "B") setTrackB(track);
    setSelectingSlot(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const fetchAISuggestions = async () => {
    if (!session?.access_token) {
      toast.error("Zaloguj się, aby otrzymać sugestie AI");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-mix-suggest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "AI error");
      setSuggestions(data.suggestions || []);
      if (data.suggestions?.length) {
        toast.success(`🧠 AI zasugerowało ${data.suggestions.length} par do miksowania!`);
      } else {
        toast.info("AI nie znalazło jeszcze sugestii — dodaj więcej utworów do biblioteki");
      }
    } catch (err: any) {
      toast.error("Błąd AI: " + err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const applySuggestion = async (s: AISuggestion) => {
    // Fetch full track data with audio_url
    const { data } = await supabase
      .from("tracks")
      .select("id, title, artist, audio_url, genre, duration")
      .in("id", [s.track_a_id, s.track_b_id]);
    if (!data || data.length < 2) {
      toast.error("Nie znaleziono utworów");
      return;
    }
    const a = data.find(t => t.id === s.track_a_id) as TrackItem;
    const b = data.find(t => t.id === s.track_b_id) as TrackItem;
    if (a) setTrackA(a);
    if (b) setTrackB(b);
    setMixStyle(s.mix_style);
    toast.success(`Załadowano: "${a?.title}" × "${b?.title}"`);
  };

  const saveMixPreference = async (rating: number) => {
    if (!user || !trackA || !trackB) return;
    try {
      await supabase.from("mix_preferences").insert({
        user_id: user.id,
        track_a_id: trackA.id,
        track_b_id: trackB.id,
        track_a_title: trackA.title,
        track_b_title: trackB.title,
        track_a_genre: trackA.genre,
        track_b_genre: trackB.genre,
        mix_style: mixStyle,
        rating,
      });
      toast.success(`Ocena ${rating}⭐ zapisana — AI się uczy!`);
      // Refresh history
      const { data } = await supabase
        .from("mix_preferences")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setMixHistory(data || []);
    } catch (err: any) {
      toast.error("Błąd zapisu: " + err.message);
    }
  };

  const handleMix = async () => {
    if (!trackA?.audio_url || !trackB?.audio_url) {
      toast.error("Wybierz oba utwory z audio URL");
      return;
    }
    setMixing(true);
    setMixResult(null);
    try {
      const result = await mixAudioFiles(trackA.audio_url, trackB.audio_url, {
        style: mixStyle,
        crossfadeDuration: crossfadeDur,
        gainA: gainA / 100,
        gainB: gainB / 100,
      });
      result.title = `${trackA.title} × ${trackB.title}`;
      setMixResult(result);
      toast.success(`🎛️ Mix "${result.title}" gotowy!`);
    } catch (err: any) {
      toast.error("Błąd miksowania: " + (err.message || "Nieznany błąd"));
    } finally {
      setMixing(false);
    }
  };

  const saveToLibrary = async () => {
    if (!mixResult) return;
    try {
      const { error } = await supabase.from("tracks").insert({
        title: mixResult.title,
        artist: "GrouAI Mix",
        album: "AI Mixed",
        duration: mixResult.duration,
        audio_url: mixResult.audioUrl,
        genre: [trackA?.genre, trackB?.genre].filter(Boolean).join(" × ") || "Mix",
        mood: "mixed",
      });
      if (error) throw error;
      toast.success("Mix zapisany w bibliotece! 📀");
    } catch (err: any) {
      toast.error("Błąd zapisu: " + err.message);
    }
  };

  const TrackSlot = ({ slot, track, onRemove }: { slot: "A" | "B"; track: TrackItem | null; onRemove: () => void }) => (
    <Droppable droppableId={`mixer-${slot}`}>
      {(provided, snapshot) => (
        <motion.div
          ref={provided.innerRef}
          {...provided.droppableProps}
          layout
          className={`p-3 rounded-xl border min-h-[72px] flex items-center gap-3 cursor-pointer transition-all ${
            snapshot.isDraggingOver
              ? "border-[#FF9500] bg-[#FF6B00]/10 ring-2 ring-[#FF6B00]/30"
              : isDragging
                ? "border-[#FF6B00]/40 bg-[#1a1a2e]/80 border-dashed"
                : "border-[#FF6B00]/20 bg-[#1a1a2e]/60 hover:border-[#FF6B00]/50"
          }`}
          onClick={() => { if (!track) { setSelectingSlot(slot); } }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: slot === "A" ? "linear-gradient(135deg, #FF6B00, #FF9500)" : "linear-gradient(135deg, #9333EA, #FF6B00)" }}>
            <span className="text-white font-bold text-sm">{slot}</span>
          </div>
          {track ? (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <p className="text-xs text-gray-400 truncate">{track.artist} <span className="text-[7px] font-bold text-primary/70">Grouarock®</span> • {track.genre || "—"}</p>
            </div>
          ) : snapshot.isDraggingOver ? (
            <p className="text-sm text-[#FF9500] flex items-center gap-2 animate-pulse">
              <Plus className="h-4 w-4" /> Upuść tutaj!
            </p>
          ) : isDragging ? (
            <p className="text-sm text-[#FF6B00]/60 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Przeciągnij utwór tutaj
            </p>
          ) : (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Wybierz lub przeciągnij utwór
            </p>
          )}
          {track && (
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-500 hover:text-red-400 transition-colors p-1">
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="hidden">{provided.placeholder}</div>
        </motion.div>
      )}
    </Droppable>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9333EA, #FF6B00)", boxShadow: "0 0 20px #9333EA40" }}>
          <Blend className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Track Mixer</h2>
          <p className="text-xs text-gray-400">Wybierz 2 utwory z biblioteki i zmiksuj je</p>
        </div>
      </div>

      {/* AI Suggestions Button */}
      {user && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={fetchAISuggestions}
            disabled={loadingSuggestions}
            variant="outline"
            className="w-full gap-2 border-[#9333EA]/30 text-[#9333EA] hover:bg-[#9333EA]/10 hover:text-white h-10"
          >
            <Brain className="h-4 w-4" />
            {loadingSuggestions ? "AI analizuje..." : "🧠 Sugestie AI — co zmiksować?"}
          </Button>
        </motion.div>
      )}

      {/* AI Suggestions List */}
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden"
          >
            <Label className="text-sm text-gray-300 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#FF9500]" />
              Sugestie AI ({suggestions.length})
            </Label>
            {suggestions.map((s, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => applySuggestion(s)}
                className="w-full p-3 rounded-xl border border-[#9333EA]/20 bg-[#1a1a2e]/60 hover:border-[#9333EA]/50 transition-all text-left space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">
                    {s.track_a.title} × {s.track_b.title}
                  </span>
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#9333EA]/20 text-[#9333EA] border-[#9333EA]/30 shrink-0">
                    {Math.round(s.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{s.reason}</p>
                <div className="flex gap-1.5">
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#FF6B00]/10 text-[#FF9500] border-[#FF6B00]/20">
                    {s.track_a.genre || "—"}
                  </Badge>
                  <span className="text-[10px] text-gray-500">×</span>
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#9333EA]/10 text-[#9333EA] border-[#9333EA]/20">
                    {s.track_b.genre || "—"}
                  </Badge>
                  <Badge className="text-[10px] px-1.5 py-0 bg-white/5 text-gray-400 border-white/10 ml-auto">
                    {s.mix_style}
                  </Badge>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track Slots */}
      <div className="space-y-2">
        <TrackSlot slot="A" track={trackA} onRemove={() => { setTrackA(null); setMixResult(null); }} />
        <div className="flex justify-center">
          <Shuffle className="h-4 w-4 text-[#FF6B00]/50" />
        </div>
        <TrackSlot slot="B" track={trackB} onRemove={() => { setTrackB(null); setMixResult(null); }} />
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {selectingSlot && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-2"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[#FF9500]" />
              <Label className="text-sm text-gray-300">Szukaj utworu do slotu {selectingSlot}</Label>
              <button onClick={() => { setSelectingSlot(null); setSearchQuery(""); }} className="ml-auto text-xs text-gray-500 hover:text-gray-300">
                Anuluj ✕
              </button>
            </div>
            <Input
              placeholder="Wpisz tytuł, artystę lub gatunek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1a1a2e] border-[#FF6B00]/20 text-white placeholder:text-gray-500 focus:border-[#FF6B00]"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searching && <p className="text-xs text-gray-500 text-center py-2">Szukam...</p>}
              {!searching && searchResults.length === 0 && searchQuery.trim() && (
                <p className="text-xs text-gray-500 text-center py-2">Brak wyników</p>
              )}
              {searchResults.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTrack(t)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#FF6B00]/10 transition-colors text-left"
                >
                  <Music className="h-4 w-4 text-[#FF9500] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.title}</p>
                    <p className="text-xs text-gray-400 truncate">{t.artist} • {t.genre || "—"} • {Math.floor(t.duration / 60)}:{(t.duration % 60).toString().padStart(2, "0")}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mix Controls */}
      <AnimatePresence>
        {trackA && trackB && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label className="text-sm text-gray-300">Styl miksowania</Label>
              <div className="flex gap-2">
                {MIX_STYLES.map((s) => (
                  <Badge
                    key={s.value}
                    className={`cursor-pointer text-xs px-3 py-1.5 transition-all ${
                      mixStyle === s.value
                        ? "text-white border-transparent"
                        : "bg-transparent border-[#9333EA]/20 text-gray-400 hover:border-[#9333EA]/50"
                    }`}
                    style={mixStyle === s.value ? { background: "linear-gradient(135deg, #9333EA, #FF6B00)", boxShadow: "0 0 12px #9333EA50" } : undefined}
                    onClick={() => setMixStyle(s.value)}
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500">{MIX_STYLES.find(s => s.value === mixStyle)?.desc}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Głośność A</span><span>{gainA}%</span>
                </div>
                <Slider value={[gainA]} onValueChange={([v]) => setGainA(v)} min={10} max={100} step={5} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Głośność B</span><span>{gainB}%</span>
                </div>
                <Slider value={[gainB]} onValueChange={([v]) => setGainB(v)} min={10} max={100} step={5} />
              </div>
            </div>

            {mixStyle === "crossfade" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Crossfade</span><span>{crossfadeDur}s</span>
                </div>
                <Slider value={[crossfadeDur]} onValueChange={([v]) => setCrossfadeDur(v)} min={1} max={10} step={1} />
              </div>
            )}

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleMix}
                disabled={mixing}
                className="w-full h-12 text-base font-bold text-white border-0 gap-2"
                style={{
                  background: mixing ? "#333" : "linear-gradient(135deg, #9333EA, #FF6B00)",
                  boxShadow: mixing ? "none" : "0 0 30px #9333EA40, 0 4px 20px #FF6B0030",
                }}
              >
                <Blend className="h-5 w-5" />
                {mixing ? "Miksuję..." : "🎛️ Miksuj utwory"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {mixing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NeonWavesLoader />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {mixResult && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 rounded-2xl border border-[#9333EA]/30 bg-[#1a1a2e]/80 space-y-3"
            style={{ boxShadow: "0 0 30px #9333EA20" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #9333EA, #FF6B00)" }}>
                <Disc3 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{mixResult.title}</p>
                <p className="text-xs text-[#9333EA]/70">GrouAI Mix • {mixStyle} • {mixResult.duration}s</p>
              </div>
            </div>

            <WaveformPlayer
              audioUrl={mixResult.audioUrl}
              title={mixResult.title}
              genre={mixStyle}
              onSaveToLibrary={saveToLibrary}
            />

            {/* Rating */}
            {user && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <ThumbsUp className="h-3 w-3" /> Oceń mix — AI nauczy się twoich preferencji
                </p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => saveMixPreference(r)}
                      className="p-1.5 rounded-lg hover:bg-[#FF6B00]/10 transition-colors group"
                    >
                      <Star className={`h-5 w-5 transition-colors ${r <= 3 ? "text-gray-500 group-hover:text-[#FF9500]" : "text-gray-600 group-hover:text-[#FF9500]"}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={saveToLibrary}
              variant="outline"
              className="w-full gap-2 border-[#9333EA]/30 text-[#9333EA] hover:bg-[#9333EA]/10 hover:text-white"
            >
              <Save className="h-4 w-4" />
              Zapisz mix do biblioteki
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mix History */}
      {mixHistory.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-gray-300 flex items-center gap-2">
            <Disc3 className="h-4 w-4 text-[#FF9500]" />
            Historia miksów ({mixHistory.length})
          </Label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {mixHistory.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#1a1a2e]/40 border border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{m.track_a_title} × {m.track_b_title}</p>
                  <p className="text-[10px] text-gray-500">{m.track_a_genre} × {m.track_b_genre} • {m.mix_style}</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < (m.rating || 0) ? "text-[#FF9500] fill-[#FF9500]" : "text-gray-600"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
