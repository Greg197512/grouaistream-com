// GrouAI czat: powiadomienia push (także przy zamkniętej apce) + głośne „Hej, jesteś!!” w otwartej apce.
// Push: /push-sw.js (bez cache) + api/chat-push (VAPID, urządzenia w bazie sbmf). Klucz publiczny VAPID nie jest tajny.
import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BJMvR5rqWR8_1-00DaDPEIh8UMThNeXiufFDrCal8h8VHakcqWt53Tbn2NuR9SMQMy4KplA5wbBpfzOavEIJTRI";
const VOICE_KEY = "grouai-chat-voice";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";

/** iPhone/iPad: push działa tylko w apce dodanej do ekranu głównego (iOS 16.4+). */
export const needsInstallForPush = () => {
  if (typeof navigator === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
};

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function call(body: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const r = await fetch("/api/chat-push", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => null);
  return r ? r.json().catch(() => null) : null;
}

async function registration() {
  const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready.catch(() => {});
  return reg;
}

/** Prośba o zgodę (wołać z kliknięcia) + zapis urządzenia. Zwraca stan. */
export async function enableChatPush(lang: string): Promise<"on" | "denied" | "unsupported" | "install" | "error"> {
  if (needsInstallForPush()) return "install";
  if (!pushSupported()) return "unsupported";
  const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (perm !== "granted") return "denied";
  try {
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    const r = await call({ action: "subscribe", sub: sub.toJSON(), lang });
    return r?.ok ? "on" : "error";
  } catch {
    return "error";
  }
}

/** Po zalogowaniu: jeśli zgoda już jest, odnów zapis (subskrypcja potrafi się zmienić). Bez pytania o zgodę. */
export async function refreshChatPush(lang: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try { await enableChatPush(lang); } catch { /* */ }
}

export async function chatPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  return !!(reg && (await reg.pushManager.getSubscription().catch(() => null)));
}

export const testChatPush = () => call({ action: "test" });

/** Po wysłaniu wiadomości — serwer sprawdza nadawcę i wysyła push odbiorcy (fire-and-forget). */
export function notifyChatPush(messageId: string) { void call({ action: "notify", messageId }); }

// ── Głos w otwartej apce ─────────────────────────────────────────────────────
export const chatVoiceOn = () => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } };
export const setChatVoice = (on: boolean) => { try { localStorage.setItem(VOICE_KEY, on ? "on" : "off"); } catch { /* */ } };

const SAY: Record<string, (n: string) => string> = {
  pl: (n) => `Hej, jesteś?! ${n} pisze do Ciebie!`,
  en: (n) => `Hey, you there?! ${n} is messaging you!`,
  nl: (n) => `Hé, ben je er?! ${n} stuurt je een bericht!`,
  uk: (n) => `Гей, ти тут?! ${n} пише тобі!`,
};
const BCP: Record<string, string> = { pl: "pl-PL", en: "en-US", nl: "nl-NL", uk: "uk-UA" };
let lastSaid = 0;

/** Głośne zawołanie. Najpierw głos przeglądarki (głośność max), bez niego — /api/voice. */
export function announceChat(name: string, lang: string) {
  if (!chatVoiceOn() || Date.now() - lastSaid < 4000) return;
  lastSaid = Date.now();
  const l = (lang || "pl").slice(0, 2);
  const text = (SAY[l] ?? SAY.pl)(name || "Ktoś");
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  const voices = synth?.getVoices() ?? [];
  const voice = voices.find((v) => v.lang?.toLowerCase().startsWith(l)) ?? null;
  if (synth && voice) {
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang; u.volume = 1; u.rate = 1.05; u.pitch = 1.1;
      synth.speak(u);
      return;
    } catch { /* fallback niżej */ }
  }
  try {
    const a = new Audio(`/api/voice?l=${encodeURIComponent(l)}&t=${encodeURIComponent(text)}`);
    a.volume = 1;
    void a.play().catch(() => {});
  } catch { /* */ }
}

// ── Zapasowy e-mail ──────────────────────────────────────────────────────────
/** Po zalogowaniu: zapis e-maila/języka — odbiorca bez powiadomień push dostanie „Hej, jesteś?!” mailem. */
export const chatHello = (lang: string) => call({ action: "hello", lang });

/** Admin, raz na dobę: wszyscy zarejestrowani trafiają do zapasu e-mail (też ci, co dawno się nie logowali). */
export async function syncAllChatUsers() {
  const k = "grouai-chat-sync";
  try { if (localStorage.getItem(k) === new Date().toISOString().slice(0, 10)) return; } catch { /* */ }
  const r = await call({ action: "sync-users" });
  if (r?.ok) try { localStorage.setItem(k, new Date().toISOString().slice(0, 10)); } catch { /* */ }
}

/** Baner z prośbą o zgodę: pokazujemy, gdy zgoda nieustalona (albo iPhone bez apki na ekranie), nie częściej niż co 3 dni. */
const ASK_KEY = "grouai-push-ask";
export function shouldAskPush(): boolean {
  try { if (Date.now() - Number(localStorage.getItem(ASK_KEY) || 0) < 3 * 864e5) return false; } catch { /* */ }
  if (needsInstallForPush()) return true;
  return pushSupported() && Notification.permission === "default";
}
export const snoozePushAsk = () => { try { localStorage.setItem(ASK_KEY, String(Date.now())); } catch { /* */ } };
