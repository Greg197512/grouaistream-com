// GrouAI Studio → Spotify Ready: przetwarzanie gotowego utworu w przeglądarce.
// Pobranie (przez nasze /api/media — R2 nie ma CORS) → dekodowanie → 44,1 kHz stereo →
// mastering −14 LUFS / −1 dBTP → WAV 16 bit → okładka 3000×3000 → R2 → znaczek w bazie.
import { zipSync, strToU8 } from "fflate";
import { toast } from "sonner";
import { rawDb } from "@/lib/untypedSupabase";
import { uploadToR2 } from "@/lib/r2Upload";
import {
  COVER_SIZE, RELEASE_SAMPLE_RATE, cleanLyrics, cleanTitle, encodeWav16, isExplicit, masterForRelease,
  releaseChecks, type ReleaseCheck,
} from "@/lib/releasePrep";

export type ReleasePackage = {
  status: "ready" | "needs_fix";
  title: string;
  artist: string;
  genre: string;
  explicit: boolean;
  instrumental: boolean;
  lyrics: string;
  wav_url: string;
  cover_url: string | null;
  duration: number;
  lufs: number;
  true_peak: number;
  checks: ReleaseCheck[];
  /** Informacja dla dystrybutora — sklepy wymagają deklaracji użycia narzędzi AI. */
  ai_assisted: true;
  prepared_at: string;
};

/** Plik z innego hosta pobieramy przez nasze proxy (same-origin, poprawny CORS). */
export function viaProxy(url: string): string {
  if (url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("/")) return url;
  try {
    if (new URL(url).origin === window.location.origin) return url;
  } catch { /* zły adres — niech fetch zgłosi błąd */ }
  return `/api/media?u=${encodeURIComponent(url)}`;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(viaProxy(url));
  if (!r.ok) throw new Error(`Nie udało się pobrać pliku (HTTP ${r.status})`);
  return r.arrayBuffer();
}

/** Dekoduje audio i przelicza do 44,1 kHz stereo. */
async function decodeTo44k(data: ArrayBuffer): Promise<Float32Array[]> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(data);
    const length = Math.ceil(decoded.duration * RELEASE_SAMPLE_RATE);
    const off = new OfflineAudioContext(2, length, RELEASE_SAMPLE_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination); // mono → oba kanały (upmix przeglądarki)
    src.start();
    const out = await off.startRendering();
    return [out.getChannelData(0), out.getChannelData(1)];
  } finally {
    void ctx.close();
  }
}

/** Okładka 3000×3000 JPG: przeskalowana okładka utworu albo abstrakcyjna grafika bez napisów. */
async function makeCover(coverUrl: string | null | undefined, seed: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = COVER_SIZE;
  const g = canvas.getContext("2d")!;
  let drawn = false;
  if (coverUrl) {
    try {
      const bmp = await createImageBitmap(new Blob([await fetchBytes(coverUrl)]));
      const scale = Math.max(COVER_SIZE / bmp.width, COVER_SIZE / bmp.height);
      const w = bmp.width * scale, h = bmp.height * scale;
      g.imageSmoothingQuality = "high";
      g.drawImage(bmp, (COVER_SIZE - w) / 2, (COVER_SIZE - h) / 2, w, h);
      drawn = true;
    } catch { /* brak okładki → grafika zastępcza */ }
  }
  if (!drawn) {
    let h = 0;
    for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360;
    const grad = g.createLinearGradient(0, 0, COVER_SIZE, COVER_SIZE);
    grad.addColorStop(0, `hsl(${hue} 70% 18%)`);
    grad.addColorStop(1, `hsl(${(hue + 60) % 360} 80% 45%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, COVER_SIZE, COVER_SIZE);
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(((h >> i) % 3000), ((h >> (i + 3)) % 3000), 400 + (i * 220), 0, Math.PI * 2);
      g.fillStyle = `hsla(${(hue + i * 25) % 360} 90% 60% / 0.12)`;
      g.fill();
    }
  }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("okładka"))), "image/jpeg", 0.92));
}

export async function prepareRelease(opts: {
  audioUrl: string; coverUrl?: string | null; title: string; artist: string; genre?: string;
  lyrics?: string | null; instrumental?: boolean; userId: string; onStep?: (label: string) => void;
}): Promise<ReleasePackage> {
  const step = opts.onStep ?? (() => {});
  step("Studio: pobieram nagranie…");
  const channels = await decodeTo44k(await fetchBytes(opts.audioUrl));
  step("Studio: mastering do −14 LUFS…");
  await new Promise((r) => setTimeout(r, 0)); // oddaj wątek UI przed cięższym liczeniem
  const m = masterForRelease(channels, RELEASE_SAMPLE_RATE);
  const wav = encodeWav16(m.channels, RELEASE_SAMPLE_RATE);
  const title = cleanTitle(opts.title);
  const lyrics = opts.instrumental ? "" : cleanLyrics(opts.lyrics);
  const safe = title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40) || "track";

  step("Studio: zapisuję WAV i okładkę 3000×3000…");
  const coverBlob = await makeCover(opts.coverUrl, title);
  const [wavUp, coverUp] = await Promise.all([
    uploadToR2({ file: new File([wav], `${safe}_${Date.now()}.wav`, { type: "audio/wav" }), folder: `release/${opts.userId}` }),
    uploadToR2({ file: new File([coverBlob], `${safe}_${Date.now()}_3000.jpg`, { type: "image/jpeg" }), folder: `release/${opts.userId}` }),
  ]);

  const duration = m.channels[0].length / RELEASE_SAMPLE_RATE;
  const checks = releaseChecks({
    title, artist: opts.artist, durationSec: duration, sampleRate: RELEASE_SAMPLE_RATE, channels: m.channels.length,
    lufs: m.lufs, truePeak: m.truePeak, coverSize: COVER_SIZE, lyrics, instrumental: !!opts.instrumental,
  });
  return {
    status: checks.every((c) => c.ok) ? "ready" : "needs_fix",
    title, artist: opts.artist, genre: opts.genre || "Pop", explicit: isExplicit(lyrics),
    instrumental: !!opts.instrumental, lyrics,
    wav_url: wavUp.publicUrl, cover_url: coverUp.publicUrl,
    duration: Math.round(duration), lufs: Math.round(m.lufs * 10) / 10, true_peak: Math.round(m.truePeak * 10) / 10,
    checks, ai_assisted: true, prepared_at: new Date().toISOString(),
  };
}

/**
 * Przepuszcza świeży utwór przez studio i nadaje znaczek. Nie rzuca — Studio pokazuje wynik
 * w powiadomieniu, a utwór i tak jest już w historii oraz w „Nowe”.
 */
export async function certifyStudioTrack(opts: Parameters<typeof prepareRelease>[0] & {
  generationId?: string | null; trackId?: string | null;
}): Promise<ReleasePackage | null> {
  try {
    const pkg = await prepareRelease(opts);
    if (opts.generationId) await rawDb.from("generations").update({ release: pkg }).eq("id", opts.generationId);
    if (opts.trackId) {
      await rawDb.from("tracks")
        .update({ release: pkg, studio_certified: pkg.status === "ready", ...(pkg.cover_url ? { cover_url: pkg.cover_url } : {}) })
        .eq("id", opts.trackId);
    }
    window.dispatchEvent(new CustomEvent("grouai:generations-changed"));
    return pkg;
  } catch (e) {
    console.warn("[GrouAI Studio] przygotowanie do Spotify nie powiodło się:", e);
    return null;
  }
}

/** certifyStudioTrack z postępem i wynikiem w powiadomieniach (Studio woła to po każdym utworze). */
export function certifyWithToasts(opts: Omit<Parameters<typeof certifyStudioTrack>[0], "onStep">): void {
  const tid = toast.loading("🎛️ Studio GrouAI przygotowuje utwór pod Spotify…");
  void certifyStudioTrack({ ...opts, onStep: (label) => toast.loading(label, { id: tid }) }).then((pkg) => {
    if (!pkg) toast.error("Studio nie zdołało przygotować pakietu Spotify — spróbuj z historii utworów.", { id: tid });
    else if (pkg.status === "ready") toast.success(`✓ GrouAI Studio: „${pkg.title}” gotowy do Spotify (${pkg.lufs} LUFS)`, { id: tid, duration: 8000 });
    else toast.warning(`Pakiet gotowy, ale do poprawy: ${pkg.checks.filter((c) => !c.ok).map((c) => c.label).join(", ")}`, { id: tid, duration: 10000 });
  });
}

/** ZIP dla dystrybutora: WAV, okładka, tekst i metadane (z deklaracją użycia AI). */
export async function downloadReleaseZip(pkg: ReleasePackage): Promise<void> {
  const [wav, cover] = await Promise.all([
    fetchBytes(pkg.wav_url),
    pkg.cover_url ? fetchBytes(pkg.cover_url) : Promise.resolve(null),
  ]);
  const meta = [
    `Tytuł: ${pkg.title}`,
    `Wykonawca: ${pkg.artist}`,
    `Gatunek: ${pkg.genre}`,
    `Explicit: ${pkg.explicit ? "tak" : "nie"}`,
    `Instrumentalny: ${pkg.instrumental ? "tak" : "nie"}`,
    `Długość: ${Math.floor(pkg.duration / 60)}:${String(pkg.duration % 60).padStart(2, "0")}`,
    `Audio: WAV 44,1 kHz / 16 bit stereo, ${pkg.lufs} LUFS, true peak ${pkg.true_peak} dBTP`,
    `Okładka: JPG 3000×3000`,
    `Utworzono z pomocą narzędzi AI: tak (GrouAI Studio) — zaznacz to w formularzu dystrybutora.`,
    `Przygotowano: ${pkg.prepared_at}`,
  ].join("\n");
  const files: Record<string, Uint8Array> = {
    [`${pkg.title}.wav`]: new Uint8Array(wav),
    "metadane.txt": strToU8(meta),
  };
  if (cover) files["okladka_3000.jpg"] = new Uint8Array(cover);
  if (pkg.lyrics) files["tekst.txt"] = strToU8(pkg.lyrics);
  const zip = zipSync(files, { level: 0 }); // WAV i JPG i tak się nie kompresują
  const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pkg.title.replace(/[^\p{L}\p{N}]+/gu, "_")}_spotify.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

