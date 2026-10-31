import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Ta tabela jest wdrażana obok wygenerowanych typów (jak w RadioStoriesPanel).
const radioDb = supabase as unknown as SupabaseClient;

const TZ = "Europe/Warsaw";

export interface StorySlotRow {
  id: string;
  slot: string;
  title: string;
  audio_url: string;
  duration_sec: number | null;
  air_times: string[] | null;
  created_at?: string | null;
}

export interface StoryOverride {
  story: StorySlotRow;
  timeStr: string;
  offset: number;
  remaining: number;
  dur: number;
}

/** „Nocna Rozmowa" — najnowszy odcinek zastępuje rotację dnia (audycja codzienna). */
export function isNocnaSlot(slot: string | null | undefined): boolean {
  return /nocna[\s-]*rozmowa/i.test(slot || "");
}

export function warsawNow(d = new Date()): { secondsOfDay: number; dayIndex: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
  const hour = Number(p.hour) % 24; // Intl potrafi zwrócić "24" o północy
  const secondsOfDay = hour * 3600 + Number(p.minute) * 60 + Number(p.second);
  const dayIndex = Math.floor(Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`) / 86400000);
  return { secondsOfDay, dayIndex };
}

export function parseTimeToSeconds(t: string): number {
  const [h, m, s] = t.split(":").map((x) => Number(x) || 0);
  return h * 3600 + m * 60 + s;
}

function byNewest(a: StorySlotRow, b: StorySlotRow): number {
  const at = Date.parse(a.created_at || "") || 0;
  const bt = Date.parse(b.created_at || "") || 0;
  if (bt !== at) return bt - at;
  return String(b.id).localeCompare(String(a.id));
}

/**
 * Która audycja leci teraz (czas polski). Logika zgodna z
 * supabase/functions/radio-stream — poza oknem godziny zwraca null
 * i radio gra zwykłą muzykę. Kilka plików na tę samą godzinę rotuje
 * dzień po dniu, z wyjątkiem Nocnej Rozmowy: tam zawsze najnowszy odcinek.
 */
export function pickStoryOverride(rows: StorySlotRow[], now = new Date()): StoryOverride | null {
  if (!rows.length) return null;
  const { secondsOfDay, dayIndex } = warsawNow(now);

  const timeSeconds = new Map<string, number>();
  for (const r of rows) {
    for (const t of r.air_times || []) {
      if (!timeSeconds.has(t)) timeSeconds.set(t, parseTimeToSeconds(t));
    }
  }
  const candidateTimes = [...timeSeconds.entries()].sort((a, b) => b[1] - a[1]);

  for (const [timeStr, startSec] of candidateTimes) {
    if (secondsOfDay < startSec) continue;
    const pool = rows.filter((r) => (r.air_times || []).includes(timeStr));
    if (!pool.length) continue;
    const nocna = pool.filter((r) => isNocnaSlot(r.slot) || isNocnaSlot(r.title));
    const story = nocna.length ? [...nocna].sort(byNewest)[0] : pool[((dayIndex % pool.length) + pool.length) % pool.length];
    const dur = story.duration_sec || 600;
    const offset = secondsOfDay - startSec;
    if (offset < 0 || offset >= dur) continue;
    return { story, timeStr, offset, remaining: dur - offset, dur };
  }
  return null;
}

export async function fetchActiveStorySlots(): Promise<StorySlotRow[]> {
  const { data, error } = await radioDb
    .from("radio_story_slots")
    .select("id, slot, title, audio_url, duration_sec, air_times, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as StorySlotRow[];
}

export async function publishRadioTalk(input: {
  title: string;
  audioUrl: string;
  durationSec: number;
  airTimes: string[];
  slot?: string;
}): Promise<{ error: string | null }> {
  const title = input.title.trim();
  const requestedSlot = (input.slot || "").trim();
  const nocna = isNocnaSlot(requestedSlot) || isNocnaSlot(title);
  const slot = nocna
    ? (isNocnaSlot(requestedSlot) ? requestedSlot : "Nocna Rozmowa")
    : (requestedSlot || "Audycja specjalna");
  const airTimes = input.airTimes.map((t) => t.trim()).filter(Boolean);
  if (!title) return { error: "Podaj nazwę odcinka" };
  if (!input.audioUrl) return { error: "Brak pliku audio" };
  if (!airTimes.length) return { error: "Podaj godzinę emisji" };

  const { data, error } = await radioDb
    .from("radio_story_slots")
    .insert({
      slot,
      title,
      audio_url: input.audioUrl,
      duration_sec: Math.max(1, Math.round(input.durationSec || 600)),
      air_times: airTimes,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !data?.id) return { error: error?.message || "Nie udało się zapisać odcinka" };

  // Nocna Rozmowa: na antenie zostaje tylko ten odcinek. Starsze zostają
  // w tabeli (plików R2 nie ruszamy), ale są wyłączone — nie wracają do rotacji.
  if (nocna) {
    await radioDb
      .from("radio_story_slots")
      .update({ is_active: false })
      .eq("slot", slot)
      .eq("is_active", true)
      .neq("id", data.id);
  }
  return { error: null };
}

function sameOverride(prev: StoryOverride | null, next: StoryOverride | null): boolean {
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  return prev.story.id === next.story.id;
}

/** Aktywna audycja (albo null). `ready` po pierwszym odczycie — radio nie startuje muzyki w ciemno. */
export function useRadioStoryOverride(enabled: boolean): { override: StoryOverride | null; ready: boolean } {
  const [override, setOverride] = useState<StoryOverride | null>(null);
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setOverride(null);
      setReady(true);
      return;
    }
    let cancel = false;
    const tick = async () => {
      try {
        const rows = await fetchActiveStorySlots();
        if (cancel) return;
        const next = pickStoryOverride(rows, new Date());
        setOverride((prev) => (sameOverride(prev, next) ? prev : next));
      } catch {
        if (!cancel) setOverride((prev) => (prev ? null : prev));
      } finally {
        if (!cancel) setReady(true);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 15000);
    // Nie trzymaj muzyki w ciszy, gdy tabela audycji nie odpowie.
    const giveUp = window.setTimeout(() => {
      if (!cancel) setReady(true);
    }, 4000);
    return () => {
      cancel = true;
      window.clearInterval(id);
      window.clearTimeout(giveUp);
    };
  }, [enabled]);

  return { override, ready };
}
