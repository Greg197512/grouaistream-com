// Nadawanie głosu na żywo do wszystkich słuchaczy radia (ten sam format co kabina admina):
// mikrofon → co 0,9 s osobny plik (MediaRecorder) → base64 → kanał Realtime „radio-live-voice”, zdarzenie „chunk”.
// Słuchacze kolejkują kawałki i grają je nad przyciszoną muzyką (RadioLive.playNextLiveVoiceChunk).
import { supabase } from "@/integrations/supabase/client";

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

export const pickLiveMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
};

/** Mikrofon dzwoniącego z redukcją echa i szumu (słuchawki zalecane). */
export async function openCallerMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
}

/**
 * Startuje nadawanie strumienia. Zwraca funkcję stop(). `onState` mówi, czy połączenie z anteną działa.
 * `tag` trafia do każdego kawałka (np. "caller"), żeby słuchacze wiedzieli, kto mówi.
 */
export function startLiveSender(stream: MediaStream, sourceId: string, tag: string, onState?: (ok: boolean) => void): () => void {
  const mimeType = pickLiveMime();
  if (!mimeType) { onState?.(false); return () => {}; }
  let active = true, ready = false, timer: number | null = null, rec: MediaRecorder | null = null;
  // realtime-js zwraca istniejący kanał o tej nazwie (strona radia już go słucha) — wtedy tylko z niego nadajemy,
  // bez ponownego subscribe() i bez usuwania go na końcu (inaczej radio przestałoby odbierać głos).
  const existing = supabase.getChannels().find((c) => c.topic === "realtime:radio-live-voice");
  const channel = existing ?? supabase.channel("radio-live-voice", { config: { broadcast: { self: false }, presence: { key: sourceId } } });

  const segment = () => {
    if (!active) return;
    const parts: Blob[] = [];
    rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64_000 });
    rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    rec.onstop = async () => {
      if (parts.length && (existing ? existing.state === "joined" : ready)) {
        try {
          const audioBase64 = b64(await new Blob(parts, { type: mimeType }).arrayBuffer());
          await channel.send({ type: "broadcast", event: "chunk", payload: { sourceId, mimeType, audioBase64, tag, sentAt: Date.now() } });
        } catch { /* pojedynczy kawałek */ }
      }
      segment();
    };
    rec.start();
    timer = window.setTimeout(() => { if (rec && rec.state !== "inactive") rec.stop(); }, 900);
  };

  if (existing) {
    ready = existing.state === "joined";
    onState?.(ready);
    segment();
  } else {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { ready = true; onState?.(true); segment(); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { ready = false; onState?.(false); }
    });
  }

  return () => {
    active = false; ready = false;
    if (timer) window.clearTimeout(timer);
    try { if (rec && rec.state !== "inactive") rec.stop(); } catch { /* */ }
    stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
    if (!existing) supabase.removeChannel(channel);
  };
}
