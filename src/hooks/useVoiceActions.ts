import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/i18n/translations";
import { voiceConfirm, type VoiceIntent } from "@/lib/voiceCommands";

const MOOD_GENRE: Record<string, string> = {
  sad: "blues",
  happy: "pop",
  chill: "ambient",
  energetic: "electronic",
  romantic: "soul",
  focus: "ambient",
};

const GENRE_ALIAS: Record<string, string> = {
  elektronika: "electronic",
  elektroniczna: "electronic",
  klasyka: "classical",
  klasyczna: "classical",
  hiphop: "hip",
  "hip hop": "hip-hop",
  "hip-hop": "hip",
  lofi: "ambient",
  "lo-fi": "ambient",
  rnb: "r&b",
};

async function findTracks(intent: Extract<VoiceIntent, { kind: "play" }>) {
  const count = Math.min(Math.max(intent.count || 12, 1), 30);
  const query = (intent.query || "").trim();

  const take = async (column: "mood" | "genre" | "title" | "artist", value: string) => {
    const { data } = await supabase
      .from("tracks")
      .select("*")
      .ilike(column, `%${value.replace(/[%_,()]/g, "")}%`)
      .not("audio_url", "is", null)
      .limit(count);
    return data || [];
  };

  if (intent.mood) {
    const byMood = await take("mood", intent.mood);
    if (byMood.length) return byMood.sort(() => Math.random() - 0.5);
    const genre = MOOD_GENRE[intent.mood];
    if (genre) {
      const byGenre = await take("genre", genre);
      if (byGenre.length) return byGenre.sort(() => Math.random() - 0.5);
    }
  }

  if (!query || query === "mix" || query === intent.mood) {
    const { data } = await supabase.from("tracks").select("*").not("audio_url", "is", null).limit(80);
    return (data || []).sort(() => Math.random() - 0.5).slice(0, count);
  }

  const alias = GENRE_ALIAS[query.toLowerCase()] || query;
  const [byGenre, byTitle, byArtist] = await Promise.all([
    take("genre", alias),
    take("title", query),
    take("artist", query),
  ]);
  const seen = new Set<string>();
  const merged = [...byGenre, ...byArtist, ...byTitle].filter((track) => {
    if (!track?.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
  return merged.slice(0, count);
}

export function useVoiceActions(language: Language) {
  const navigate = useNavigate();
  const {
    playPlaylist, nextTrack, prevTrack, setVolume, pausePlayback, resumePlayback,
    restartCurrentTrack, seek, audioElement, toggleRepeat, toggleShuffle, toggleMute,
    volume, isMuted,
  } = usePlayer();
  const volumeRef = useRef(volume);
  const mutedRef = useRef(isMuted);
  volumeRef.current = volume;
  mutedRef.current = isMuted;

  const runVoiceIntent = useCallback(async (
    intent: VoiceIntent,
    opts?: { baseVolume?: number },
  ): Promise<string> => {
    const say = (detail?: string) => voiceConfirm(language, intent, detail);
    const base = opts?.baseVolume ?? volumeRef.current;

    switch (intent.kind) {
      case "pause":
      case "stop_dj":
        pausePlayback();
        return say();
      case "resume":
        resumePlayback();
        return say();
      case "next":
        nextTrack();
        return say();
      case "previous":
        prevTrack();
        return say();
      case "restart":
        restartCurrentTrack();
        return say();
      case "seek_end":
        seek(98);
        return say();
      case "seek": {
        const dur = audioElement?.duration || 0;
        const cur = audioElement?.currentTime || 0;
        if (dur > 0) {
          const target = Math.max(0, Math.min(dur, cur + intent.deltaSec));
          seek((target / dur) * 100);
        }
        return say();
      }
      case "volume_up":
        setVolume(Math.max(0, Math.min(100, Math.round(base + 12))));
        return say();
      case "volume_down":
        setVolume(Math.max(0, Math.min(100, Math.round(base - 12))));
        return say();
      case "volume_set":
        setVolume(intent.percent);
        return say();
      case "mute":
        if (!mutedRef.current) toggleMute();
        return say();
      case "unmute":
        if (mutedRef.current) toggleMute();
        if (base <= 0) setVolume(70);
        return say();
      case "repeat":
        toggleRepeat();
        return say();
      case "shuffle":
        toggleShuffle();
        return say();
      case "radio":
        sessionStorage.setItem("grouai-radio-autostart", "1");
        navigate("/radio-live");
        window.setTimeout(() => window.dispatchEvent(new Event("grouai:start-radio")), 600);
        return say();
      case "studio":
        navigate("/studio");
        return say();
      case "party":
        if (window.location.pathname !== "/") navigate("/");
        window.setTimeout(() => window.dispatchEvent(new Event("grouai:open-party")), 350);
        return say();
      case "navigate":
        navigate(intent.route);
        return say();
      case "play": {
        try {
          const tracks = await findTracks(intent);
          if (!tracks.length) {
            const missing = intent.query && intent.query !== "mix" ? intent.query : "";
            return language === "en"
              ? `I couldn't find ${missing || "anything to play"}.`
              : language === "nl"
                ? `Ik vond ${missing || "niets"} niet.`
                : language === "ua"
                  ? `Не знайшов ${missing || "нічого"}.`
                  : `Nie znalazłam ${missing || "nic do odtworzenia"}.`;
          }
          playPlaylist(tracks as never[], 0);
          const first = tracks[0];
          return say(first?.title ? `${first.title}` : undefined);
        } catch {
          return language === "pl"
            ? "Nie udało się wyszukać utworów. Spróbuj jeszcze raz."
            : "I couldn't search for tracks. Please try again.";
        }
      }
      case "shutdown":
        return say();
      default:
        return say();
    }
  }, [
    language, navigate, playPlaylist, nextTrack, prevTrack, setVolume, pausePlayback,
    resumePlayback, restartCurrentTrack, seek, audioElement, toggleRepeat, toggleShuffle, toggleMute,
  ]);

  return { runVoiceIntent, volumeRef };
}
