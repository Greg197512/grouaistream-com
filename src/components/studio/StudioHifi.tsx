import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type Track } from "@/contexts/PlayerContext";
import { Play, Pause, SkipForward, Radio as RadioIcon, Power } from "lucide-react";

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
  const [trayOpen, setTrayOpen] = useState(false);
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
  const spinning = isPlaying;

  const startRadio = useCallback(() => {
    if (radioOn && isPlaying) { togglePlay(); return; }
    if (radioOn && !isPlaying && currentTrack) { togglePlay(); return; }
    if (pool.length === 0) return;
    setActiveArtist(null);
    setRadioOn(true);
    setTrayOpen(false);
    playPlaylist(shuffle(pool), 0, "studio-hifi-radio");
  }, [radioOn, isPlaying, currentTrack, pool, playPlaylist, togglePlay]);

  const playArtist = useCallback((name: string, tracks: Track[]) => {
    if (tracks.length === 0) return;
    setActiveArtist(name);
    setRadioOn(false);
    // Efekt wysuwanej płyty: wysuń → po chwili wsuń i graj.
    setTrayOpen(true);
    window.setTimeout(() => {
      setTrayOpen(false);
      playPlaylist(shuffle(tracks), 0, "studio-hifi-artist");
    }, 620);
  }, [playPlaylist]);

  const onTrayClick = () => {
    if (trayOpen) {
      // Wsuń szufladę → zagraj wybranego wykonawcę lub całe radio.
      setTrayOpen(false);
      const sel = activeArtist ? artists.find((a) => a.name === activeArtist) : null;
      if (sel) playPlaylist(shuffle(sel.tracks), 0, "studio-hifi-cd");
      else if (pool.length) { setRadioOn(true); playPlaylist(shuffle(pool), 0, "studio-hifi-cd"); }
    } else {
      setTrayOpen(true);
    }
  };

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
        {/* ── WIEŻA ── */}
        <div className="flex flex-col gap-1.5">
          {/* Gramofon + winyl */}
          <div className="relative rounded-xl border border-white/10 bg-black/40 p-2" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" }}>
            <div className="relative mx-auto aspect-square w-full max-w-[92px]">
              <div className={`absolute inset-0 rounded-full ${spinning ? "hf-spin-slow" : "hf-spin-slow hf-paused"}`} style={{
                background: [
                  "radial-gradient(circle at 50% 50%, #FF7A1A 0 15%, #120a1f 15.5% 20%, transparent 20.4%)",
                  "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.5) 1px 3px)",
                  "radial-gradient(circle at 50% 50%, #1a1a1f 20%, #0b0710 100%)",
                ].join(","),
                boxShadow: "0 4px 14px rgba(0,0,0,.6)",
              }} />
              {/* refleks */}
              <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "linear-gradient(120deg,transparent 42%,rgba(255,255,255,.18) 50%,transparent 58%)" }} />
              {/* ramię gramofonu */}
              <div className="absolute -right-1 -top-1 h-[58%] w-[3px] origin-top rounded-full bg-gradient-to-b from-white/70 to-white/30 transition-transform duration-500"
                style={{ transform: spinning ? "rotate(24deg)" : "rotate(-6deg)" }} />
            </div>
          </div>

          {/* Szuflada CD */}
          <button type="button" onClick={onTrayClick}
            className="relative h-9 overflow-hidden rounded-lg border border-white/10 bg-black/50 text-left"
            aria-label="Szuflada CD">
            <div className="absolute inset-y-0 left-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/45">CD</div>
            <div className={`hf-tray absolute top-1/2 -translate-y-1/2 ${trayOpen ? "translate-x-[42%]" : "translate-x-[100%]"}`} style={{ left: 0, right: 0 }}>
              <div className={`ml-auto mr-1 h-6 w-6 rounded-full ${spinning && !trayOpen ? "hf-spin" : "hf-spin hf-paused"}`} style={{
                background: "conic-gradient(from 0deg,#ff5db1,#ffd24d,#7dff9e,#5de1ff,#a98bff,#ff5db1)",
                boxShadow: "0 0 0 2px rgba(0,0,0,.4)",
              }}>
                <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#120a1f]" />
              </div>
            </div>
            <span className="absolute bottom-0.5 right-1.5 text-[8px] font-semibold text-[#FF7A1A]">{trayOpen ? "▸ wsuń" : "◂ wysuń"}</span>
          </button>

          {/* Magnetofon kasetowy */}
          <div className="flex items-center justify-around rounded-lg border border-white/10 bg-black/50 px-2 py-1.5">
            {[0, 1].map((i) => (
              <div key={i} className={`relative h-5 w-5 rounded-full border border-white/20 ${spinning ? "hf-spin" : "hf-spin hf-paused"}`}
                style={{ background: "radial-gradient(circle at 50% 50%, #2a2333 30%, #0b0710 32%)" }}>
                {[0, 60, 120].map((r) => (
                  <span key={r} className="absolute left-1/2 top-1/2 h-[9px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded bg-white/30" style={{ transform: `rotate(${r}deg)` }} />
                ))}
              </div>
            ))}
          </div>
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
