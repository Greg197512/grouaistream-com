// Telefony od słuchaczy na antenie: protokół na kanale Realtime „radio-callin”.
// UWAGA: realtime-js zwraca ISTNIEJĄCY kanał o tej samej nazwie, a drugie subscribe() rzuca błąd —
// dlatego jeden wspólny kanał na kartę (hub) i rozsyłanie zdarzeń do komponentów.
// Obecność: dzwoniący {role:"caller", callId, name, city, lang}, studio (admin) {role:"studio"}.
// Zdarzenia: accept / reject / end {callId, by}; onair {callId, name, city} i offair {callId, name} — dla wszystkich.
import { supabase } from "@/integrations/supabase/client";

export const CALLIN_CHANNEL = "radio-callin";
export const CALL_MAX_SEC = 180; // limit rozmowy na antenie

export type CallerInfo = { callId: string; name: string; city: string; lang: string; at: number; userId?: string | null };
type Meta = { role?: string } & Partial<CallerInfo>;
export type CallinEvent = "accept" | "reject" | "end" | "onair" | "offair";
type Listener = (event: CallinEvent | "presence", payload: Record<string, unknown>) => void;

/** Rozkłada stan obecności na: czy studio jest online + kolejkę dzwoniących (najstarsi pierwsi). */
export function readPresence(state: Record<string, Meta[]>): { studioOnline: boolean; callers: CallerInfo[] } {
  let studioOnline = false;
  const callers: CallerInfo[] = [];
  for (const metas of Object.values(state)) for (const m of metas) {
    if (m.role === "studio") studioOnline = true;
    if (m.role === "caller" && m.callId) callers.push({ callId: m.callId, name: m.name ?? "", city: m.city ?? "", lang: m.lang ?? "pl", at: m.at ?? 0, userId: m.userId ?? null });
  }
  callers.sort((a, b) => a.at - b.at);
  return { studioOnline, callers };
}

export const newCallId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`);

let hub: { ch: ReturnType<typeof supabase.channel>; listeners: Set<Listener>; joined: boolean; pendingTrack: Record<string, unknown> | null } | null = null;

/** Jeden kanał telefonów na kartę. `key` = stały identyfikator tej karty (obecność). */
function ensureHub(key: string) {
  if (hub) return hub;
  const ch = supabase.channel(CALLIN_CHANNEL, { config: { broadcast: { self: true }, presence: { key } } });
  const h = { ch, listeners: new Set<Listener>(), joined: false, pendingTrack: null as Record<string, unknown> | null };
  const emit: Listener = (e, p) => h.listeners.forEach((l) => { try { l(e, p); } catch { /* */ } });
  ch.on("presence", { event: "sync" }, () => emit("presence", { state: ch.presenceState() }));
  for (const ev of ["accept", "reject", "end", "onair", "offair"] as const) ch.on("broadcast", { event: ev }, ({ payload }) => emit(ev, payload ?? {}));
  ch.subscribe((s) => {
    if (s === "SUBSCRIBED") { h.joined = true; if (h.pendingTrack) { ch.track(h.pendingTrack).catch(() => {}); h.pendingTrack = null; } }
  });
  hub = h;
  return h;
}

export function callin(key: string) {
  const h = ensureHub(key);
  return {
    listen(l: Listener) { h.listeners.add(l); l("presence", { state: h.ch.presenceState() }); return () => { h.listeners.delete(l); }; },
    send(event: CallinEvent, payload: Record<string, unknown>) { return h.ch.send({ type: "broadcast", event, payload }); },
    track(meta: Record<string, unknown>) { if (h.joined) return h.ch.track(meta); h.pendingTrack = meta; return Promise.resolve("ok"); },
    untrack() { h.pendingTrack = null; return h.ch.untrack(); },
  };
}
