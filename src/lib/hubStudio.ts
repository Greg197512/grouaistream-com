import { supabase } from "@/integrations/supabase/client";
import { sameOriginMediaUrl } from "@/lib/trackFile";

// Silniki Studia działają na głównym projekcie Supabase (stary hub bmwtydwpevzhbdplilbr nie istnieje).
import { invokeHubAI } from "@/lib/hubAI";

type InvokeResult = { data: any; error: Error | null };

/**
 * NAUKA SILNIKA — pobiera „lekcje" z naszych najlepszych dotychczasowych
 * utworów w danym języku (in-context learning). Wynik dokleja się do promptu
 * planera, więc silnik komponuje wzorując się na własnych najlepszych. Ciche
 * niepowodzenie → "" (generacja i tak rusza).
 */
export async function fetchEngineLessons(_language: string): Promise<string> {
  // Usługa „nauki silnika” była na nieistniejącym hubie — generacja rusza bez lekcji.
  return "";
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
  // Odczyt nastroju przez asystenta (Vercel /api/assistant) — odpowiedź w ścisłym JSON.
  const prompt =
    `Słuchacz napisał, jak się czuje: "${text.slice(0, 400)}". Odpowiedz WYŁĄCZNIE jednym obiektem JSON (bez komentarzy) ` +
    `w języku "${language}": {"mood_label": krótka nazwa nastroju, "emoji": jedno emoji, ` +
    `"genres": 2-3 gatunki muzyczne po angielsku, "moods": 2-3 nastroje po angielsku, "energy": "low"|"mid"|"high", ` +
    `"reply": jedno ciepłe, empatyczne zdanie do słuchacza}.`;
  const { data } = await invokeHubAI({ message: prompt, userContext: { language } }, 30000);
  const raw = data?.response || "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const energy = ["low", "mid", "high"].includes(j.energy) ? j.energy : "mid";
    return {
      ok: true,
      mood_label: String(j.mood_label || ""),
      emoji: String(j.emoji || "🎧"),
      genres: Array.isArray(j.genres) ? j.genres.map(String).slice(0, 3) : [],
      moods: Array.isArray(j.moods) ? j.moods.map(String).slice(0, 3) : [],
      energy,
      reply: String(j.reply || ""),
    };
  } catch { return null; }
}

const LEARN_OFF = { ok: false, error: "Nauka silnika była na starym hubie, który już nie istnieje — panel wyłączony." };
/** Pulpit „Nauka silnika" (admin) — usługa wyłączona. */
export async function fetchEngineLearningStats(_pin: string): Promise<any> { return LEARN_OFF; }
/** Odświeżenie cache katalogu — usługa wyłączona. */
export async function refreshEngineCatalog(_pin: string): Promise<any> { return LEARN_OFF; }

/** Wywołanie silnika Studia na głównym projekcie; błąd niesie treść odpowiedzi funkcji. */
export async function invokeStudioEngine(
  fnName: string,
  body: Record<string, unknown>
): Promise<InvokeResult> {
  // Hub (bmwtydwpevzhbdplilbr) nie istnieje od 11.2026 — wszystkie silniki na głównym projekcie.
  const name = fnName === "studio-cover" ? "ai-cover-generate" : fnName;
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = await (error as any)?.context?.json?.().catch(() => null);
    return { data: ctx, error: new Error(ctx?.error || error.message) };
  }
  return { data, error: null };
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
  const { data, error } = await invokeStudioEngine("acestep-generate", {
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
  const r = await fetch(sameOriginMediaUrl(url)); // R2 bez CORS → przez /api/media
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

export type StemsMode = "2" | "4" | "6";

/** studio-stems; błąd zawiera treść odpowiedzi funkcji, nie ogólne „non-2xx". */
async function stemsFn(body: Record<string, unknown>): Promise<InvokeResult> {
  const { data, error } = await supabase.functions.invoke("studio-stems", { body });
  if (error) {
    const ctx = await (error as any)?.context?.json?.().catch(() => null);
    return { data: ctx, error: new Error(ctx?.error || error.message) };
  }
  if (data?.error) return { data, error: new Error(data.error) };
  return { data, error: null };
}

/**
 * Start rozdzielania utworu na ścieżki (Demucs na Replicate, funkcja studio-stems).
 * mode: 2 = wokal + akompaniament, 4 = wokal/perkusja/bas/reszta, 6 = + gitara, pianino.
 */
export async function startStems(audioUrl: string, mode: StemsMode = "4"): Promise<string> {
  const { data, error } = await stemsFn({ audio_url: audioUrl, mode });
  if (error) throw error;
  if (!data?.task_id) throw new Error("Nie udało się wystartować rozdzielania");
  return data.task_id as string;
}

/** Czekaj na ścieżki (poll co 5 s, max ~6 min). Zwraca mapę nazwa→url. */
export async function waitForStems(
  taskId: string,
  _trackId: string,
  onTick?: (sec: number) => void
): Promise<Record<string, string>> {
  for (let i = 1; i <= 72; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    onTick?.(i * 5);
    const { data, error } = await stemsFn({ action: "status", task_id: taskId });
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

/** Czy błąd oznacza wyczerpany dzienny limit wideo */
export function isDailyLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return msg.includes("daily_limit") || msg.includes("limit wideo");
}

/**
 * Odpal generowanie okładki w tle (Pollinations — darmowe). Okładka trafia pod
 * deterministyczny adres {taskId}-cover.jpg, więc nie trzeba czekać na wynik.
 */
export function fireCoverGeneration(_taskId: string, _title: string, _style: string, _description?: string) {
  // Wyłączone (5.11): darmowa okładka była na nieistniejącym hubie; zastępstwo ai-cover-generate jest PŁATNE
  // (OpenRouter), a jego wyniku nikt nie odczytuje. Okładkę daje silnik albo użytkownik (Cover Studio / upload).
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
    const { data, error } = await invokeStudioEngine("acestep-generate", {
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

// ─── Wideo (teledysk / film z tekstu) — funkcja studio-video (Replicate) ──────
// good → Wan 2.2 (szybki), vip → Hailuo-02 (jakość); zapas: MiniMax video-01.

/** Wywołuje studio-video; błąd zawiera treść odpowiedzi funkcji, nie ogólne „non-2xx". */
async function videoFn(body: Record<string, unknown>): Promise<InvokeResult> {
  const { data, error } = await supabase.functions.invoke("studio-video", { body });
  if (error) {
    const ctx = await (error as any)?.context?.json?.().catch(() => null);
    return { data: ctx, error: new Error(ctx?.error || error.message) };
  }
  if (data?.error) return { data, error: new Error(data.error) };
  return { data, error: null };
}

/** Wspólne odpytywanie zadania Replicate aż do gotowego wideo. */
async function waitForVideoJob(
  jobId: string, onTick: ((s: number) => void) | undefined, maxAttempts: number, failMsg: string,
): Promise<string> {
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    onTick?.(i * 5);
    const { data, error } = await videoFn({ action: "status", job_id: jobId });
    if (error) continue; // chwilowy błąd sieci — próbujemy dalej
    if (data?.status === "completed" && data?.video_url) return data.video_url as string;
    if (data?.status === "failed") throw new Error(data?.error ? `${failMsg}: ${data.error}` : failMsg);
  }
  throw new Error("Przekroczono czas oczekiwania na wideo");
}

/**
 * Zleca wygenerowanie wideo z tekstu. Zwraca { data, error }.
 * data.job_id → zlecono; odpytuj waitForStudioVideo.
 */
export async function submitStudioVideo(
  prompt: string,
  opts?: { quality?: "good" | "vip"; aspect?: string; singing?: boolean; image?: string }
): Promise<InvokeResult> {
  return videoFn({
    prompt,
    quality: opts?.quality ?? "good",
    aspect: opts?.aspect ?? "16:9",
    ...(opts?.singing ? { singing: true } : {}),
    ...(opts?.image ? { image: opts.image } : {}),
  });
}

/** Odpytuje aż wideo będzie gotowe (~10 min max). Zwraca URL albo rzuca błąd. */
export function waitForStudioVideo(jobId: string, onTick?: (elapsedSeconds: number) => void): Promise<string> {
  return waitForVideoJob(jobId, onTick, 120, "Generowanie wideo nie powiodło się");
}

export type VideoEngine = "higgsfield" | "replicate";

/** Zleca wideo z tekstu (Replicate). Zwraca { engine, jobId } do pollowania przez waitForVideoSmart. */
export async function submitVideoSmart(
  prompt: string,
  opts?: { quality?: "good" | "vip"; aspect?: string; duration?: number; image?: string; singing?: boolean }
): Promise<{ engine: VideoEngine; jobId: string }> {
  const { data, error } = await submitStudioVideo(prompt, {
    quality: opts?.quality, aspect: opts?.aspect, image: opts?.image, singing: opts?.singing,
  });
  if (error) throw error;
  if (!data?.job_id) throw new Error(data?.message || "Nie udało się zlecić wideo");
  return { engine: "replicate", jobId: String(data.job_id) };
}

/** Pollowanie zadania aż wideo będzie gotowe. Zwraca URL. */
export function waitForVideoSmart(
  _engine: VideoEngine, jobId: string, onTick?: (elapsedSeconds: number) => void
): Promise<string> {
  return waitForStudioVideo(jobId, onTick);
}

// ─── Lip-sync: usta wokalisty zsynchronizowane ze słowami (Kling / sync) ─────

/** Zleca lip-sync całego wideo do utworu. Zwraca { data, error }. */
export async function submitStudioLipsync(videoUrl: string, audioUrl: string): Promise<InvokeResult> {
  return videoFn({ action: "lipsync", video_url: videoUrl, audio_url: audioUrl });
}

/** Odpytuje aż lip-sync będzie gotowy (~15 min max). Zwraca URL wideo z dźwiękiem. */
export function waitForStudioLipsync(jobId: string, onTick?: (elapsedSeconds: number) => void): Promise<string> {
  return waitForVideoJob(jobId, onTick, 180, "Synchronizacja ust nie powiodła się");
}

// ─── Storyboard: AI układa sceny teledysku z tekstu/klimatu utworu ─────────────

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
    const { data, error } = await videoFn({ action: "storyboard", ...body });
    if (error || !Array.isArray(data?.scenes)) return [];
    return (data.scenes as string[]).filter((s) => typeof s === "string" && s.trim().length > 3);
  } catch {
    return [];
  }
}
