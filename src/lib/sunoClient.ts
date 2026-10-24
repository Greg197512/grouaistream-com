import { supabase } from "@/integrations/supabase/client";

// Generowanie przez sunoapi.org (edge function `suno-generate`, klucz SUNO_API_KEY po stronie serwera).
// Funkcja sama kopiuje gotowe nagranie i okładkę na R2, więc zwracane adresy są trwałe.

export type SunoResult = {
  audioUrl: string;
  coverUrl?: string;
  title: string;
  durationSeconds: number;
  taskId: string;
};

export type SunoRequest = {
  /** Opis utworu własnymi słowami (tryb opisowy — Suno samo pisze tekst). */
  prompt: string;
  instrumental?: boolean;
  title?: string;
  style?: string;
  lyrics?: string;
  language?: string;
  /** Ulepszanie opisu przez LLM przed wysłaniem (wolniej, ~10–20 s). */
  enhance?: boolean;
  onProgress?: (seconds: number) => void;
};

const POLL_MS = 4000;
const MAX_WAIT_MS = 300_000; // Suno renderuje zwykle 40–120 s, czasem do ~5 min

async function call(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("suno-generate", { body });
  if (error) {
    // Treść odpowiedzi funkcji (np. 401 sesji) zamiast ogólnego „non-2xx".
    const ctx = await (error as any)?.context?.json?.().catch(() => null);
    throw new Error(ctx?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function generateWithSuno(req: SunoRequest): Promise<SunoResult> {
  const started = await call({
    action: "generate",
    prompt: req.prompt,
    instrumental: !!req.instrumental,
    title: req.title || undefined,
    style: req.style || undefined,
    lyrics: req.lyrics || undefined,
    vocal_language: req.language,
    enhance: req.enhance ?? false,
  });
  const taskId: string | undefined = started?.id || started?.task_id;
  if (!taskId) throw new Error("Suno nie zwróciło numeru zadania");

  const t0 = Date.now();
  while (Date.now() - t0 < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    req.onProgress?.(Math.round((Date.now() - t0) / 1000));
    let st: any;
    try {
      st = await call({ action: "status", task_id: taskId });
    } catch {
      continue; // chwilowy błąd sieci — pytamy dalej
    }
    if (st?.status === "succeeded") {
      if (!st.audio_url) throw new Error("Suno nie zwróciło pliku audio");
      return {
        audioUrl: st.audio_url,
        coverUrl: st.cover_url || undefined,
        title: st.title || req.title || started?.title || "GrouAI Track",
        durationSeconds: Math.round(st.duration || 0),
        taskId,
      };
    }
    if (st?.status === "failed") throw new Error(st.error || "Suno nie wygenerowało utworu");
  }
  throw new Error("Suno nie skończyło w 5 minut — spróbuj ponownie");
}
