import { startStems, waitForStems } from "@/lib/hubStudio";
import { mixAudioFiles, MixResult } from "@/utils/audioMixer";

// PRAWDZIWY mashup: wokal z utworu A na podkładzie (instrumentalu) z utworu B.
// 1) Demucs (studio-stems) rozdziela oba na wokal/perkusję/bas/resztę,
// 2) składamy instrumental B (drums+bass+other),
// 3) kładziemy wokal A na podkład B — z beatmatchem/EQ/masteringiem z mixAudioFiles.
// Wymaga planu Pro/Ultimate (studio-stems jest premium) i ~2-3 min (2× Demucs).
export async function mashupWithStems(
  urlA: string,
  urlB: string,
  onProgress?: (msg: string) => void,
): Promise<MixResult> {
  onProgress?.("Rozdzielam ścieżki obu utworów (Demucs) — ~2-3 min…");
  const [taskA, taskB] = await Promise.all([startStems(urlA), startStems(urlB)]);
  const [stemsA, stemsB] = await Promise.all([
    waitForStems(taskA, "mashupA"),
    waitForStems(taskB, "mashupB"),
  ]);

  const vocalsA = stemsA.vocals;
  if (!vocalsA) throw new Error("Nie wykryto wokalu w utworze A (wybierz utwór ze śpiewem jako A)");

  onProgress?.("Buduję podkład z B i nakładam na niego wokal A…");
  const parts = ["drums", "bass", "other"].map((k) => stemsB[k]).filter(Boolean) as string[];
  if (!parts.length) throw new Error("Brak podkładu w utworze B");

  // Sklej podkład B (drums + bass + other) w jeden.
  let bgUrl = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const r = await mixAudioFiles(bgUrl, parts[i], { style: "overlay", gainA: 0.95, gainB: 0.95 });
    bgUrl = r.audioUrl;
  }

  // Wokal A na podkład B — bas trzyma B, wokal na wierzchu, z beatmatchem.
  const result = await mixAudioFiles(vocalsA, bgUrl, { style: "mashup", gainA: 1.0, gainB: 0.9 });
  result.title = "Mashup PRO (wokal A × podkład B)";
  return result;
}
