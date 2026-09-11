// Kuratorska pula dobrych teledysków AI (prawdziwe ID YouTube) — te „fajne z
// początku": hip-hop, rasta/reggae oraz techno/disco. Odtwarzane jako własna
// playlista YouTube (next/prev cyklują). Martwe filmy są pomijane (onError).
export const AI_TELEDYSKI: string[] = [
  // Hip-Hop / Rap / Drill
  "2Xy-ax7VyNI", // Nowhere Beach – Mad Science (psychedelic hip-hop)
  "xOSW36TSsiQ", // DJAI – Grow Up (reggae roots + hip-hop)
  "1SWBizKojIw", // No Replay (AI rap duet)
  "217f2kdwXAE", // The Dor Brothers – The Hardest AI Music Video
  "iL7qiFEyILY", // The Dor Brothers – The Hardest AI Music Video II
  "TbXZoMocpM8", // The Dor Brothers – The Drill
  "0iGWxsKhxHo", // Futuristic Hip-Hop
  // Rasta / Reggae
  "1ZAVKZ7k5b8", // AI Reggae Song 2025 – Roots & Conscious Dub
  "oiNkrgSXjc4", // Reggae Robot – AI reggae
  "lEiBwm0n3Gk", // AI Reggae Banger
  // Techno / Disco / Funk
  "JPGgtHuw2VA", // KYNTIC – Neon Fractal Genesis (techno)
  "ECIrWFBuOMA", // Fahri Yilmaz – Space Party (techno)
  "cxPv3oC-Yis", // Oscar Morales – Make it Easy for Me (disco-funk)
  "dg7BElt9ghQ", // AIVA – Moonwalk (disco)
];

import { searchYouTube } from "@/lib/reelSearch";

// Rotujące zapytania — dają „więcej nowości" (inny zestaw przy każdym otwarciu).
const FRESH_QUERIES = [
  "AI music video 2026",
  "AI generated music video official",
  "Suno AI song official video",
  "AI hip hop music video",
  "AI techno music video",
  "AI reggae music video",
  "AI synthwave music video",
  "AI pop music video 2026",
];

// Świeża pula do rolki: kuratorska lista (pewna jakość) + świeże AI-teledyski
// wyszukane na żywo w YouTube (tylko osadzalne). Dedup, limit. Fallback = kuratorska.
export async function loadFreshTeledyski(max = 40): Promise<string[]> {
  try {
    const picks = [...FRESH_QUERIES].sort(() => Math.random() - 0.5).slice(0, 3);
    const results = await Promise.all(picks.map((q) => searchYouTube(q).catch(() => [])));
    const fresh = results.flat().map((h) => h.videoId).filter(Boolean);
    const merged = [...new Set([...AI_TELEDYSKI, ...fresh])];
    return merged.slice(0, max);
  } catch {
    return AI_TELEDYSKI;
  }
}
