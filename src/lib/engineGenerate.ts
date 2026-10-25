import { invokeStudioEngine, isSubscriptionError } from "@/lib/hubStudio";
import { generateWithSuno } from "@/lib/sunoClient";

export type Engine = "suno" | "acestep" | "musicgen";

export const ENGINE_INFO: Record<Engine, { label: string; emoji: string; blurb: string; color: string }> = {
  suno: {
    label: "GrouAI Studio",
    emoji: "⭐",
    blurb: "Suno V5 — najwyższa jakość, pełny wokal (~2-4 min)",
    color: "#FFD400",
  },
  acestep: {
    label: "ACE-Step",
    emoji: "🆓",
    blurb: "Darmowy, bez limitu kredytów — śpiewa Twój tekst",
    color: "#FF9500",
  },
  musicgen: {
    label: "MusicGen",
    emoji: "🎹",
    blurb: "Szybki instrumental, bez wokalu (do 30s)",
    color: "#9333EA",
  },
};

export type GenerateTrackOpts = {
  engine: Engine;
  prompt: string;
  title?: string;
  style?: string;
  instrumental?: boolean;
  lyrics?: string;
  language?: string;
  duration?: number;
  onProgress?: (seconds: number) => void;
};

export type GenerateTrackResult = {
  title: string;
  audioUrl: string;
  coverUrl?: string;
  durationSeconds: number;
};

// ACE-Step (via Replicate, hub) wymaga tekstu gdy nie jest instrumentalny — bez
// niego po cichu śpiewa "[instrumental]" i user dostaje muzykę bez wokalu mimo
// że o niego prosił. Dopisujemy tekst przez AI (studio-prompt-engine), po cichu.
async function ensureLyrics(prompt: string, language: string | undefined): Promise<string> {
  try {
    const { data, error } = await invokeStudioEngine("studio-prompt-engine", {
      prompt, plan_only: true, language: language || "pl",
    });
    if (error) return "";
    const full = (data as any)?.plan?.full_lyrics;
    return typeof full === "string" ? full.trim() : "";
  } catch {
    return "";
  }
}

async function pollHubEngine(
  fnName: "acestep-generate" | "groua-music-engine",
  predictionId: string,
  generationId: string | undefined,
  maxAttempts: number,
  onProgress?: (seconds: number) => void,
): Promise<{ audioUrl: string; coverUrl?: string; title?: string; duration?: number }> {
  let attempts = 0;
  let consecutiveErrors = 0;
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, 3000));
    onProgress?.(attempts * 3);
    try {
      const { data, error } = await invokeStudioEngine(fnName, {
        action: "status", prediction_id: predictionId, task_id: predictionId, taskId: predictionId, generation_id: generationId,
      });
      if (error) throw error;
      consecutiveErrors = 0;
      const status = (data as any)?.status;
      if (status === "succeeded" || status === "completed" || status === "ready") {
        const url = (data as any)?.audio_url || (typeof (data as any)?.output === "string" ? (data as any).output : (data as any)?.output?.[0]);
        if (!url) throw new Error("Silnik nie zwrócił pliku audio");
        return { audioUrl: url, coverUrl: (data as any)?.cover_url, title: (data as any)?.title, duration: (data as any)?.duration };
      }
      if (status === "failed" || status === "canceled") {
        throw new Error((data as any)?.error || "Silnik nie wygenerował utworu");
      }
    } catch (e: any) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) throw new Error(e?.message || "Utracono połączenie z silnikiem");
    }
  }
  throw new Error("Silnik nie skończył w wyznaczonym czasie — spróbuj ponownie");
}

/** Jeden wspólny punkt wejścia do generowania utworu — wybierz silnik, reszta jest identyczna. */
export async function generateTrack(opts: GenerateTrackOpts): Promise<GenerateTrackResult> {
  const { engine, prompt, title, style, instrumental, language, duration } = opts;

  if (engine === "suno") {
    const r = await generateWithSuno({
      prompt, instrumental, title, style, lyrics: opts.lyrics, language, enhance: true, onProgress: opts.onProgress,
    });
    return { title: r.title, audioUrl: r.audioUrl, coverUrl: r.coverUrl, durationSeconds: r.durationSeconds };
  }

  if (engine === "acestep") {
    let lyrics = (opts.lyrics || "").trim();
    if (!instrumental && !lyrics) lyrics = await ensureLyrics(prompt, language);
    if (!instrumental && !lyrics) {
      // AI nie zdążyło/nie udało się — lepiej jasny błąd niż cichy instrumental.
      throw new Error("Nie udało się przygotować tekstu dla ACE-Step — spróbuj ponownie lub włącz tryb instrumentalny");
    }
    const { data, error } = await invokeStudioEngine("acestep-generate", {
      action: "generate", prompt, lyrics, instrumental: !!instrumental,
      duration: Math.min(Math.max(duration || 120, 10), 240), title: title || undefined, genre: style || undefined,
    });
    if (error) {
      if (isSubscriptionError(error)) throw error;
      throw new Error(error.message || "ACE-Step nie przyjęło zadania");
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    const predId = (data as any)?.id;
    const genId = (data as any)?.generation_id;
    if (!predId) throw new Error("ACE-Step nie zwróciło numeru zadania");
    const res = await pollHubEngine("acestep-generate", predId, genId, 100, opts.onProgress); // 100x3s = 5 min
    return { title: res.title || title || "GrouAI Track", audioUrl: res.audioUrl, coverUrl: res.coverUrl, durationSeconds: res.duration || duration || 0 };
  }

  // musicgen
  const { data, error } = await invokeStudioEngine("groua-music-engine", {
    action: "generate", prompt, duration: Math.min(duration || 30, 30), instrumental: true,
    use_fingerprint: true, title: title || undefined,
  });
  if (error) {
    if (isSubscriptionError(error)) throw error;
    throw new Error(error.message || "MusicGen nie przyjęło zadania");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  const predId = (data as any)?.id;
  const genId = (data as any)?.generation_id;
  if (!predId) throw new Error("MusicGen nie zwróciło numeru zadania");
  const res = await pollHubEngine("groua-music-engine", predId, genId, 80, opts.onProgress); // 80x3s = 4 min
  return { title: res.title || title || "GrouAI Track", audioUrl: res.audioUrl, coverUrl: res.coverUrl, durationSeconds: res.duration || duration || 0 };
}
