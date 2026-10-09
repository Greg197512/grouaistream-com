import premium from "@/assets/hero-premium-audio.jpg";
import neon from "@/assets/hero-neon.jpg";
import original from "@/assets/hero-bg.jpg";

const ARTWORK = [premium, neon, original];
// Monday-aligned UTC weeks. Local assets only: no AI calls, uploads or database jobs.
export function weeklyArtwork(now = Date.now()): string {
  const week = Math.floor((now - Date.UTC(2026, 9, 5)) / 604800000);
  return ARTWORK[((week % ARTWORK.length) + ARTWORK.length) % ARTWORK.length];
}