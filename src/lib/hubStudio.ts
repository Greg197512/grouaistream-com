import { supabase } from "@/integrations/supabase/client";

// Silnik ACE-Step działa na hubie GrouAI (funkcja na bvstv woła zły endpoint
// Replicate i nie da się jej podmienić bez Lovable). Hub weryfikuje JWT
// użytkownika przez auth LIVE, więc kontrakt jest identyczny.
const HUB_ACESTEP_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/acestep-generate";
const HUB_PROMPT_ENGINE_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-prompt-engine";
const HUB_COVER_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-cover";
const HUB_STEMS_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-stems";

type InvokeResult = { data: any; error: Error | null };

/**
 * Zamiennik supabase.functions.invoke dla silników Studia.
 * "acestep-generate" → hub; pozostałe funkcje → normalnie na LIVE.
 */
async function hubFetch(url: string, body: Record<string, unknown>): Promise<InvokeResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { data: null, error: new Error("Zaloguj się, aby generować muzykę") };

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      return { data, error: new Error(data?.error || `Silnik zwrócił błąd ${r.status}`) };
    }
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function invokeStudioEngine(
  fnName: string,
  body: Record<string, unknown>
): Promise<InvokeResult> {
  if (fnName === "acestep-generate") return hubFetch(HUB_ACESTEP_URL, body);
  if (fnName === "studio-prompt-engine") return hubFetch(HUB_PROMPT_ENGINE_URL, body);
  if (fnName === "ai-cover-generate" || fnName === "studio-cover") return hubFetch(HUB_COVER_URL, body);
  return supabase.functions.invoke(fnName, { body });
}

/**
 * Pobierz audio jako WAV wysokiej jakości (16-bit PCM 44.1 kHz) —
 * dekodowanie w przeglądarce, bez dodatkowych kosztów serwera.
 */
export async function downloadAudioAsWav(url: string, filename: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const arrayBuffer = await r.arrayBuffer();
  const ctx = new AudioContext();
  const audio = await ctx.decodeAudioData(arrayBuffer);
  void ctx.close();

  // Enkoder WAV (PCM 16-bit, interleaved)
  const numCh = audio.numberOfChannels;
  const len = audio.length * numCh * 2;
  const buffer = new ArrayBuffer(44 + len);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF"); view.setUint32(4, 36 + len, true); writeStr(8, "WAVE");
  writeStr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * numCh * 2, true); view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true); writeStr(36, "data"); view.setUint32(40, len, true);
  let off = 44;
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(audio.getChannelData(c));
  for (let i = 0; i < audio.length; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  const blob = new Blob([buffer], { type: "audio/wav" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/** Start rozdzielania utworu na ścieżki (Demucs na hubie). Zwraca task_id. */
export async function startStems(audioUrl: string): Promise<string> {
  const { data, error } = await hubFetch(HUB_STEMS_URL, { audio_url: audioUrl });
  if (error) throw error;
  if (!data?.task_id) throw new Error(data?.error || "Nie udało się wystartować");
  return data.task_id as string;
}

/** Czekaj na ścieżki (poll co 5 s, max ~5 min). Zwraca mapę nazwa→url. */
export async function waitForStems(
  taskId: string,
  trackId: string,
  onTick?: (sec: number) => void
): Promise<Record<string, string>> {
  for (let i = 1; i <= 60; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    onTick?.(i * 5);
    const { data, error } = await hubFetch(HUB_STEMS_URL, { action: "status", task_id: taskId, id: trackId });
    if (error) continue;
    if (data?.status === "succeeded" && data?.stems) return data.stems as Record<string, string>;
    if (data?.status === "failed") throw new Error(data?.error || "Rozdzielanie nie powiodło się");
  }
  throw new Error("Przekroczono czas oczekiwania");
}

/** Pobierz plik audio na dysk użytkownika (jak przycisk Download w Suno) */
export async function downloadAudio(url: string, filename: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/** Czy błąd silnika oznacza brak planu płatnego */
export function isSubscriptionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("subscription_required") || msg.includes("wymaga planu");
}

/**
 * Odpal generowanie okładki w tle (Pollinations — darmowe). Okładka trafia pod
 * deterministyczny adres {taskId}-cover.jpg, więc nie trzeba czekać na wynik.
 */
export function fireCoverGeneration(taskId: string, title: string, style: string, description?: string) {
  void hubFetch(HUB_COVER_URL, {
    id: taskId,
    title,
    style,
    ...(description ? { description } : {}),
  }).catch(() => {});
}

/**
 * Czeka aż generacja ACE-Step się skończy (odpytuje hub co 4 s).
 * Zwraca adres audio albo rzuca błąd.
 */
export async function waitForAceStep(
  taskId: string,
  generationId?: string | null,
  onTick?: (elapsedSeconds: number) => void
): Promise<{ audioUrl: string; coverUrl: string | null }> {
  const maxAttempts = 90; // ~6 minut
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 4000));
    onTick?.(i * 4);
    const { data, error } = await hubFetch(HUB_ACESTEP_URL, {
      action: "status",
      task_id: taskId,
      generation_id: generationId ?? undefined,
    });
    if (error) continue; // chwilowy błąd sieci — próbujemy dalej
    if (data?.status === "succeeded" && data?.audio_url) {
      return { audioUrl: data.audio_url as string, coverUrl: (data.cover_url as string) || null };
    }
    if (data?.status === "failed") throw new Error(data?.error || "Generacja nie powiodła się");
  }
  throw new Error("Przekroczono czas oczekiwania na utwór");
}
