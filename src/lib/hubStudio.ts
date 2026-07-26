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
const HUB_ENGINE_LEARN_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/engine-learn";
const HUB_WHISPER_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/whisper-dj";

type InvokeResult = { data: any; error: Error | null };

/**
 * NAUKA SILNIKA — pobiera „lekcje" z naszych najlepszych dotychczasowych
 * utworów w danym języku (in-context learning). Wynik dokleja się do promptu
 * planera, więc silnik komponuje wzorując się na własnych najlepszych. Ciche
 * niepowodzenie → "" (generacja i tak rusza).
 */
export async function fetchEngineLessons(language: string): Promise<string> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const r = await fetch(HUB_ENGINE_LEARN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action: "lessons", language }),
    });
    const d = await r.json().catch(() => null);
    return d?.ok && typeof d.lessons === "string" ? d.lessons : "";
  } catch { return ""; }
}

export interface WhisperReading {
  ok: boolean;
  mood_label: string;
  emoji: string;
  genres: string[];
  moods: string[];
  energy: "low" | "mid" | "high";
  reply: string;
  error?: string;
}

/**
 * „Szept o 4:17" — piszesz jednym zdaniem jak się czujesz, AI czyta emocję i
 * zwraca gatunki/nastroje + jedno empatyczne zdanie. Frontend dobiera JEDEN utwór.
 */
export async function whisperFeeling(text: string, language: string): Promise<WhisperReading | null> {
  try {
    const r = await fetch(HUB_WHISPER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    return (await r.json().catch(() => null)) as WhisperReading | null;
  } catch { return null; }
}

/** Pulpit „Nauka silnika" (admin, PIN wspólny z panelami). */
export async function fetchEngineLearningStats(pin: string): Promise<any> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const r = await fetch(HUB_ENGINE_LEARN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "stats", pin }),
  });
  return r.json().catch(() => null);
}

/** Wymusza odświeżenie cache katalogu (20k+ utworów) z bvstv. */
export async function refreshEngineCatalog(pin: string): Promise<any> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const r = await fetch(HUB_ENGINE_LEARN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: "refresh_catalog", pin }),
  });
  return r.json().catch(() => null);
}

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
 * „Zaśpiewaj moim głosem" — zero-shot konwersja głosu (seed-vc na hubie, bez
 * klucza Suno). Bierze gotowy utwór + próbkę głosu i zwraca ten utwór zaśpiewany
 * Twoją barwą. Zwraca { task_id, generation_id } do pollowania waitForAceStep.
 */
export async function startVoiceCover(
  audioUrl: string,
  voiceUrl: string,
  opts?: { title?: string; pitch?: number }
): Promise<{ taskId: string; generationId: string | null }> {
  const { data, error } = await hubFetch(HUB_ACESTEP_URL, {
    action: "voice_cover",
    audio_url: audioUrl,
    voice_url: voiceUrl,
    ...(opts?.title ? { title: opts.title } : {}),
    ...(typeof opts?.pitch === "number" ? { pitch: opts.pitch } : {}),
  });
  if (error) throw error;
  if (!data?.id) throw new Error(data?.error || "Nie udało się wystartować konwersji głosu");
  return { taskId: data.id as string, generationId: (data.generation_id as string) ?? null };
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

// ─── Wideo (teledysk / film z tekstu) — Replicate przez hub ────────────────────
// good → LTX-Video (szybki, tani), vip → MiniMax video-01 (jakość, plan Pro/Ultimate).
const HUB_VIDEO_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-video";

/**
 * Zleca wygenerowanie wideo z tekstu. Zwraca { data, error }.
 * data.job_id → zlecono; odpytuj waitForStudioVideo.
 * error „subscription_required" → jakość VIP wymaga planu.
 */
export async function submitStudioVideo(
  prompt: string,
  opts?: { quality?: "good" | "vip"; aspect?: string; singing?: boolean }
): Promise<InvokeResult> {
  return hubFetch(HUB_VIDEO_URL, {
    prompt,
    quality: opts?.quality ?? "good",
    aspect: opts?.aspect ?? "16:9",
    ...(opts?.singing ? { singing: true } : {}),
  });
}

/** Odpytuje hub aż wideo będzie gotowe. Zwraca URL albo rzuca błąd. */
export async function waitForStudioVideo(
  jobId: string,
  onTick?: (elapsedSeconds: number) => void
): Promise<string> {
  const maxAttempts = 120; // ~10 minut
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    onTick?.(i * 5);
    const { data, error } = await hubFetch(HUB_VIDEO_URL, { action: "status", job_id: jobId });
    if (error) continue; // chwilowy błąd sieci — próbujemy dalej
    if (data?.status === "completed" && data?.video_url) return data.video_url as string;
    if (data?.status === "failed") throw new Error("Generowanie wideo nie powiodło się");
  }
  throw new Error("Przekroczono czas oczekiwania na wideo");
}

// ─── Lip-sync: usta wokalisty zsynchronizowane ze słowami (LatentSync, VIP) ─────
const HUB_LIPSYNC_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-lipsync";

/** Zleca lip-sync całego wideo do utworu. Zwraca { data, error }. */
export async function submitStudioLipsync(videoUrl: string, audioUrl: string): Promise<InvokeResult> {
  return hubFetch(HUB_LIPSYNC_URL, { video_url: videoUrl, audio_url: audioUrl });
}

/** Odpytuje aż lip-sync będzie gotowy. Zwraca URL wideo (z wgranym audio). */
export async function waitForStudioLipsync(
  jobId: string,
  onTick?: (elapsedSeconds: number) => void
): Promise<string> {
  const maxAttempts = 180; // ~15 minut — lip-sync jest wolniejszy
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    onTick?.(i * 5);
    const { data, error } = await hubFetch(HUB_LIPSYNC_URL, { action: "status", job_id: jobId });
    if (error) continue;
    if (data?.status === "completed" && data?.video_url) return data.video_url as string;
    if (data?.status === "failed") throw new Error("Synchronizacja ust nie powiodła się");
  }
  throw new Error("Przekroczono czas oczekiwania na lip-sync");
}

// ─── Storyboard: AI układa sceny teledysku z tekstu/klimatu utworu ─────────────
const HUB_STORYBOARD_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-storyboard";

/** Zwraca listę opisów ujęć (po angielsku) wygenerowanych z piosenki. Nigdy nie rzuca. */
export async function fetchStoryboard(body: {
  song_prompt?: string;
  title?: string;
  tags?: string;
  lyrics?: string;
  style?: string;
  count?: number;
  singing?: boolean;
}): Promise<string[]> {
  try {
    const { data, error } = await hubFetch(HUB_STORYBOARD_URL, body);
    if (error || !Array.isArray(data?.scenes)) return [];
    return (data.scenes as string[]).filter((s) => typeof s === "string" && s.trim().length > 3);
  } catch {
    return [];
  }
}
