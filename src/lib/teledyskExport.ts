// Sklejanie teledysku w JEDEN plik MP4 w przeglądarce (ffmpeg.wasm, single-thread).
//
// Świadomie single-thread core (@ffmpeg/core, NIE core-mt) — nie wymaga
// SharedArrayBuffer ani nagłówków COOP/COEP, więc NIE psuje CORS mediów w apce
// (a tego tu pilnujemy). Klipy z replicate.delivery nie mają CORS → pobieramy je
// przez hub media-proxy. Wynik: krótki teledysk (klipy + utwór), idealny na
// TikTok / Shorts / Reels.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const PROXY = "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/media-proxy?u=";
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

const prox = (u: string) => (u.startsWith("blob:") || u.startsWith("data:") ? u : PROXY + encodeURIComponent(u));

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: `${CORE_BASE}/ffmpeg-core.js`,
      wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
    });
    ffmpeg = ff;
    return ff;
  })();
  return loadPromise;
}

/**
 * Skleja klipy + utwór w jeden MP4 (Blob). onProgress: 0-100.
 * Najpierw szybki concat (kopiowanie strumienia); przy niezgodności — re-enkod.
 */
export async function exportTeledysk(
  videoUrls: string[],
  audioUrl: string,
  onProgress?: (pct: number) => void,
  aspect: "9:16" | "16:9" = "16:9",
): Promise<Blob> {
  const [W, H] = aspect === "9:16" ? [720, 1280] : [1280, 720];
  if (!videoUrls.length) throw new Error("brak ujęć");
  const ff = await getFfmpeg();

  if (onProgress) {
    ff.on("progress", ({ progress }: { progress: number }) => {
      const p = Math.max(0, Math.min(99, Math.round((progress || 0) * 100)));
      onProgress(p);
    });
  }

  // Wgraj pliki do wirtualnego FS ffmpeg.
  const names: string[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const name = `c${i}.mp4`;
    await ff.writeFile(name, await fetchFile(prox(videoUrls[i])));
    names.push(name);
  }
  await ff.writeFile("song.mp3", await fetchFile(prox(audioUrl)));

  // Ścieżka szybka: concat demuxer + kopiowanie wideo, tylko audio przekodowane.
  const list = names.map((n) => `file '${n}'`).join("\n");
  await ff.writeFile("list.txt", new TextEncoder().encode(list));

  const readOut = async () => {
    const data = (await ff.readFile("out.mp4")) as Uint8Array;
    return new Blob([data], { type: "video/mp4" });
  };

  try {
    await ff.exec([
      "-f", "concat", "-safe", "0", "-i", "list.txt",
      "-i", "song.mp3",
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
      "-shortest", "-movflags", "+faststart", "out.mp4",
    ]);
    return await readOut();
  } catch {
    // Ścieżka pewna: przeskaluj wszystkie ujęcia i sklej (re-enkod) — wolniej, ale zawsze działa.
    const inputs: string[] = [];
    names.forEach((n) => { inputs.push("-i", n); });
    inputs.push("-i", "song.mp3");
    const n = names.length;
    const filter =
      names.map((_, i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24[v${i}]`).join(";") +
      ";" + names.map((_, i) => `[v${i}]`).join("") + `concat=n=${n}:v=1:a=0[vout]`;
    await ff.exec([
      ...inputs,
      "-filter_complex", filter,
      "-map", "[vout]", "-map", `${n}:a:0`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest", "-movflags", "+faststart", "out.mp4",
    ]);
    return await readOut();
  }
}
