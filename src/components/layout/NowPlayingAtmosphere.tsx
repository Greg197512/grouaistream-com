import { useEffect, useMemo } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

/** Kolor tła zmienia się wraz z okładką, ale zostaje w fiolecie i magencie GrouAI. */
function brandHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  return 258 + (hash % 78);
}

export const NowPlayingAtmosphere = () => {
  const { currentTrack, isPlaying } = usePlayer();
  const seed = currentTrack?.cover_url || currentTrack?.title || currentTrack?.artist || "grouai";
  const hue = useMemo(() => brandHue(seed), [seed]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--np-hue", String(hue));
    root.style.setProperty("--np-hue-2", String((hue + 42) % 360));
    return () => {
      root.style.removeProperty("--np-hue");
      root.style.removeProperty("--np-hue-2");
    };
  }, [hue]);

  return (
    <div
      aria-hidden
      className="np-atmosphere pointer-events-none fixed inset-0"
      data-playing={isPlaying ? "true" : "false"}
    />
  );
};
