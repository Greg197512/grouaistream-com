import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { Play, Pause, SkipForward, Radio as RadioIcon, Power } from "lucide-react";
import { StudioCore } from "@/components/studio/StudioCore";

/**
 * GrouAI Studio — kompaktowa, DZIAŁAJĄCA wieża hi-fi (zamiast equalizera).
 *  • Gramofon z winylem na górze — kręci się, gdy gra muzyka; ramię opada.
 *  • Wysuwana szuflada CD — klik = wysuń/wsuń (wsunięcie startuje odtwarzanie).
 *  • Magnetofon kasetowy — szpule kręcą się podczas grania.
 *  • RADIO (power) — po włączeniu gra NASZE utwory (losowo).
 *  • Wykonawcy — klik w wybranego gra WYŁĄCZNIE jego utwory.
 * Wszystko przez wspólny PlayerContext. Zajmuje mało miejsca (jedna karta).
 */

const TRACK_SELECT = "id,title,artist,album,duration,cover_url,audio_url,video_url,genre,mood";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const StudioHifi = () => {
  const { playPlaylist, togglePlay, nextTrack, isPlaying, currentTrack } = usePlayer();
  const [pool, setPool] = useState<Track[]>([]);
  const [activeArtist, setActiveArtist] = useState<string | null>(null);
  const [radioOn, setRadioOn] = useState(false);
  const loadedRef = useRef(false);

  // Pobierz nasz katalog (utwory z grającym źródłem).
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("tracks")
        .select(TRACK_SELECT)
        .or("audio_url.not.is.null,video_url.not.is.null")
        .order("created_at", { ascending: false })
        .limit(120);
      const seen = new Set<string>();
      const rows = ((data as Track[]) || []).filter((t) => {
        if (!t || seen.has(t.id)) return false;
        seen.add(t.id);
        return Boolean(t.audio_url || t.video_url);
      });
      setPool(rows);
    })();
  }, []);

  // Wykonawcy pogrupowani wg nazwy (najwięcej utworów na górze).
  const artists = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const t of pool) {
      const name = (t.artist || "").trim();
      if (!name) continue;
      const list = map.get(name) || [];
      list.push(t);
      map.set(name, list);
    }
    return [...map.entries()]
      .map(([name, tracks]) => ({ name, tracks }))
      .sort((a, b) => b.tracks.length - a.tracks.length)
      .slice(0, 16);
  }, [pool]);

  const playingArtist = currentTrack?.artist?.trim() || null;

  const startRadio = useCallback(() => {
    if (radioOn && isPlaying) { togglePlay(); return; }
    if (radioOn && !isPlaying && currentTrack) { togglePlay(); return; }
    if (pool.length === 0) return;
    setActiveArtist(null);
    setRadioOn(true);
    playPlaylist(shuffle(pool), 0, "studio-hifi-radio");
  }, [radioOn, isPlaying, currentTrack, pool, playPlaylist, togglePlay]);

  const playArtist = useCallback((name: string, tracks: Track[]) => {
    if (tracks.length === 0) return;
    setActiveArtist(name);
    setRadioOn(false);
    playPlaylist(shuffle(tracks), 0, "studio-hifi-artist");
  }, [playPlaylist]);

  // Klik w rdzeń: graj/pauza jeśli coś załadowane, inaczej odpal radio.
  const onCoreClick = useCallback(() => {
    if (currentTrack) togglePlay();
    else startRadio();
  }, [currentTrack, togglePlay, startRadio]);

  const title = currentTrack?.title || "GrouAI HiFi";
  const sub = currentTrack ? (currentTrack.artist || "—") : (pool.length ? `${pool.length} utworów · ${artists.length} wykonawców` : "Ładowanie katalogu…");

  return (
    <div className="studio-hero-glass relative mx-auto w-full max-w-md overflow-hidden rounded-3xl p-3 sm:p-4">
      <div className="studio-aurora" aria-hidden />
      <style>{`
        @keyframes hifi-spin{to{transform:rotate(360deg)}}
        .hf-spin{animation:hifi-spin 3.2s linear infinite}
        .hf-spin-slow{animation:hifi-spin 6s linear infinite}
        .hf-paused{animation-play-state:paused}
        .hf-tray{transition:transform .55s cubic-bezier(.22,1,.36,1)}
        @media (prefers-reduced-motion:reduce){.hf-spin,.hf-spin-slow{animation:none}}
      `}</style>

      <div className="relative z-10 grid grid-cols-[104px_1fr] gap-3 sm:grid-cols-[120px_1fr] sm:gap-4">
        {/* ── GROUAI CORE (reaktywna kula energii; klik = graj/pauza) ── */}
        <div className="flex flex-col justify-center">
          <StudioCore
            active={isPlaying}
            onClick={onCoreClick}
            label={radioOn ? "Radio" : isPlaying ? "Live" : "Core"}
          />
        </div>

        {/* ── PANEL STEROWANIA ── */}
        <div className="flex min-w-0 flex-col">
          {/* Wyświetlacz */}
          <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isPlaying ? "bg-emerald-400" : "bg-white/25"}`} style={isPlaying ? { boxShadow: "0 0 8px #34d399" } : undefined} />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF9500]">{radioOn ? "Radio ON" : isPlaying ? "Gra" : "Gotowe"}</span>
            </div>
            <div className="mt-0.5 truncate font-display text-sm font-extrabold text-white">{title}</div>
            <div className="truncate text-[11px] text-white/55">{sub}</div>
          </div>

          {/* Przyciski */}
          <div className="mt-2 flex items-center gap-1.5">
            <button type="button" onClick={startRadio} disabled={!pool.length}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#FF7A1A]/50 bg-[#FF7A1A]/10 px-2 py-2 text-[11px] font-bold text-[#FFB020] transition hover:bg-[#FF7A1A]/20 disabled:opacity-40"
              aria-label="Radio">
              {radioOn ? <Power className="h-3.5 w-3.5" /> : <RadioIcon className="h-3.5 w-3.5" />} Radio
            </button>
            <button type="button" onClick={togglePlay} disabled={!currentTrack}
              className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gradient-to-br from-[#FF7A1A] to-[#FFB020] text-black transition hover:brightness-110 disabled:opacity-40"
              aria-label={isPlaying ? "Pauza" : "Graj"}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => nextTrack()} disabled={!currentTrack}
              className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-white/12 bg-white/5 text-white/80 transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Następny">
              <SkipForward className="h-4 w-4" />
            </button>
          </div>

          {/* Wykonawcy */}
          <div className="mt-2 min-w-0">
            <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Wykonawcy · graj tylko jego</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              {artists.length === 0 && <span className="text-[11px] text-white/35">—</span>}
              {artists.map((a) => {
                const on = activeArtist === a.name || playingArtist === a.name;
                return (
                  <button key={a.name} type="button" onClick={() => playArtist(a.name, a.tracks)}
                    className={`flex-none whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${on ? "border-[#FF7A1A] bg-[#FF7A1A] text-black" : "border-white/12 bg-white/5 text-white/75 hover:border-white/30"}`}>
                    {a.name} <span className={on ? "text-black/60" : "text-white/35"}>· {a.tracks.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
