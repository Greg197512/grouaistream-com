// Darmowy neuronowy głos w przeglądarce (Piper / VITS przez vits-web).
// Zero serwera, zero API, zero kosztów: model liczy się na urządzeniu użytkownika,
// pobiera się raz i jest cache'owany (OPFS/IndexedDB). Licencja MIT.

type VitsMod = typeof import("@diffusionstudio/vits-web");
let mod: VitsMod | null = null;
let moduleBroken = false; // brak WASM/wsparcia → nie próbuj w kółko

// Najlepsze głosy per język (naturalne, „medium/high").
const VOICE: Record<string, string> = {
  pl: "pl_PL-darkman-medium",        // PL męski, ciepły
  en: "en_US-ryan-high",             // EN męski, wysoka jakość
  nl: "nl_NL-mls-medium",            // NL
  ua: "uk_UA-ukrainian_tts-medium",  // UA
};
// Alternatywy (np. żeński PL) — do ewentualnego wyboru z zewnątrz.
export const NEURAL_VOICE_ALT: Record<string, string> = {
  pl: "pl_PL-gosia-medium",
  en: "en_US-hfc_female-medium",
};

export function neuralVoiceFor(lang?: string, voiceId?: string): string {
  if (voiceId) return voiceId;
  const l = (lang || "pl").slice(0, 2).toLowerCase();
  return VOICE[l] || VOICE.pl;
}

export function isNeuralTtsAvailable(): boolean {
  return !moduleBroken && typeof WebAssembly !== "undefined";
}

/**
 * Syntezuj mowę neuronowo → zwraca WAV Blob (albo null, gdy niedostępne).
 * onProgress: 0..1 postęp pobierania modelu przy pierwszym użyciu.
 */
export async function neuralSynth(
  text: string,
  lang?: string,
  opts?: { voiceId?: string; onProgress?: (p: number) => void },
): Promise<Blob | null> {
  if (moduleBroken || typeof WebAssembly === "undefined") return null;
  const clean = (text || "").trim();
  if (!clean) return null;
  try {
    if (!mod) mod = await import("@diffusionstudio/vits-web");
  } catch (e) {
    console.warn("[neuralTts] moduł niedostępny:", e);
    moduleBroken = true;
    return null;
  }
  try {
    const voiceId = neuralVoiceFor(lang, opts?.voiceId);
    const wav = await mod.predict(
      { text: clean, voiceId } as Parameters<VitsMod["predict"]>[0],
      opts?.onProgress ? (p: any) => opts.onProgress!(typeof p?.loaded === "number" && p?.total ? p.loaded / p.total : 0) : undefined,
    );
    return wav instanceof Blob ? wav : null;
  } catch (e) {
    console.warn("[neuralTts] synteza nie powiodła się:", e);
    return null; // pojedynczy błąd — spróbujemy fallbacku, nie wyłączamy silnika
  }
}

/** Pobierz model głosu z wyprzedzeniem (żeby pierwsza wypowiedź była natychmiastowa). */
export async function neuralPrefetch(lang?: string, onProgress?: (p: number) => void): Promise<void> {
  await neuralSynth("Cześć.", lang, { onProgress });
}
