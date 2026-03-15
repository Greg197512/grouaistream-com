import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Search, Plus, X, Blend, Music, Disc3, Save, Shuffle } from "lucide-react";

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  audio_url: string | null;
  genre: string | null;
  duration: number;
}

const MIX_STYLES: { value: MixStyle; label: string; desc: string }[] = [
  { value: "crossfade", label: "Crossfade", desc: "Płynne przejście A → B" },
  { value: "overlay", label: "Overlay", desc: "Oba naraz, pełny mix" },
  { value: "mashup", label: "Mashup", desc: "Stereo blend ze stereo panningiem" },
];

export const TrackMixer = () => {
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
    <motion.div
      layout
      className="p-3 rounded-xl border border-[#FF6B00]/20 bg-[#1a1a2e]/60 min-h-[72px] flex items-center gap-3 cursor-pointer hover:border-[#FF6B00]/50 transition-colors"
      onClick={() => { if (!track) { setSelectingSlot(slot); } }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: slot === "A" ? "linear-gradient(135deg, #FF6B00, #FF9500)" : "linear-gradient(135deg, #9333EA, #FF6B00)" }}>
        <span className="text-white font-bold text-sm">{slot}</span>
      </div>
      {track ? (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{track.title}</p>
          <p className="text-xs text-gray-400 truncate">{track.artist} • {track.genre || "—"}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Wybierz utwór
        </p>
      )}
      {track && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-gray-500 hover:text-red-400 transition-colors p-1">
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9333EA, #FF6B00)", boxShadow: "0 0 20px #9333EA40" }}>
          <Blend className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Track Mixer</h2>
          <p className="text-xs text-gray-400">Wybierz 2 utwory z biblioteki i zmiksuj je</p>
        </div>
      </div>

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

      {/* Mix Controls (show when both tracks selected) */}
      <AnimatePresence>
        {trackA && trackB && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Mix Style */}
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

            {/* Gain Controls */}
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

            {/* Crossfade duration (for crossfade mode) */}
            {mixStyle === "crossfade" && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Crossfade</span><span>{crossfadeDur}s</span>
                </div>
                <Slider value={[crossfadeDur]} onValueChange={([v]) => setCrossfadeDur(v)} min={1} max={10} step={1} />
              </div>
            )}

            {/* Mix Button */}
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
    </div>
  );
};
