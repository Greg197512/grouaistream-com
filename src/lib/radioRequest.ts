import { supabase } from "@/integrations/supabase/client";

// Prośby słuchaczy o utwór w radiu. Asystent tekstowy rozpoznaje zdanie typu
// „zagraj Kult - Dziewczyna o 20:30" albo „zagraj https://youtu.be/… o 21" i zapisuje
// prośbę. Godzina to czas polski (Europe/Warsaw); bez godziny → zagra od razu.

const TZ = "Europe/Warsaw";
const TRIGGER = /(zagraj|zagraj mi|pu[sś][cć]|graj|wrzu[cć]|dedykuj|dedykacj[aę]|życzenie|zyczenie)/i;
const NOW_WORDS = /\b(teraz|zaraz|od razu|natychmiast)\b/i;
const YT_RE = /(?:youtube\.com\/watch\?(?:[^ ]*&)?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/i;
const TIME_RE = /\bo\s*(\d{1,2})(?:[:.](\d{2}))?\b/i;

export type ParsedRequest =
  | { kind: "song"; title: string; artist: string | null; playAt: Date; raw: string }
  | { kind: "youtube"; youtubeId: string; title: string; playAt: Date; raw: string };

// --- Czas w strefie Warszawa -------------------------------------------------

function partsIn(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const o: Record<string, number> = {};
  for (const x of p) if (x.type !== "literal") o[x.type] = +x.value;
  return o;
}

function warsawOffsetMs(at: Date): number {
  const p = partsIn(at, TZ);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - at.getTime();
}

/** Zamienia lokalny czas warszawski (y, m, d, h, mi) na chwilę UTC. */
function warsawLocalToDate(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - warsawOffsetMs(new Date(guess));
  t = guess - warsawOffsetMs(new Date(t)); // druga iteracja na przejściu DST
  return new Date(t);
}

/** Najbliższa przyszła chwila o godz. h:mi (czas polski). Jeśli minęła — jutro. */
function nextWarsawTime(h: number, mi: number, now: Date): Date {
  const p = partsIn(now, TZ);
  let t = warsawLocalToDate(p.year, p.month, p.day, h, mi);
  if (t.getTime() < now.getTime() - 60_000) {
    const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    t = warsawLocalToDate(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), h, mi);
  }
  return t;
}

// --- Parsowanie zdania -------------------------------------------------------

/** Zwraca prośbę, jeśli zdanie jest prośbą o zagranie utworu; w przeciwnym razie null. */
export function parseRadioRequest(text: string, now = new Date()): ParsedRequest | null {
  const raw = text.trim();
  if (!raw || !TRIGGER.test(raw)) return null;

  // Godzina („teraz" wygrywa z godziną; bez godziny → od razu)
  const tm = raw.match(TIME_RE);
  const h = tm ? +tm[1] : NaN;
  const mi = tm?.[2] ? +tm[2] : 0;
  const hasValidTime = !!tm && h <= 23 && mi <= 59;
  const playAt =
    NOW_WORDS.test(raw) || !hasValidTime
      ? new Date(now.getTime() + 5_000)
      : nextWarsawTime(h, mi, now);

  // Wideo z YouTube
  const yt = raw.match(YT_RE);
  if (yt) {
    const title = raw
      .replace(/https?:\/\/\S+/g, " ") // najpierw cały link, nie tylko identyfikator
      .replace(TIME_RE, " ")
      .replace(NOW_WORDS, " ")
      .replace(TRIGGER, " ")
      .replace(/\s+/g, " ")
      .trim() || "Wideo z YouTube";
    return { kind: "youtube", youtubeId: yt[1], title, playAt, raw };
  }

  // Utwór z katalogu: „Wykonawca - Tytuł" albo sama nazwa.
  const core = raw
    .replace(TIME_RE, " ")
    .replace(NOW_WORDS, " ")
    .replace(TRIGGER, " ")
    .replace(/\b(utw[oó]r|piosenk[ęe]|piosenkę|kawałek|kawalek|mi|proszę|prosze|prosz[ęe]|w radiu)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!core) return null;
  const sep = core.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return sep
    ? { kind: "song", artist: sep[1].trim(), title: sep[2].trim(), playAt, raw }
    : { kind: "song", artist: null, title: core, playAt, raw };
}

// --- Zapis prośby ------------------------------------------------------------

const clean = (s: string) => s.replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim();

const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);

export interface SubmitResult {
  ok: boolean;
  message: string;
}

/** Dopasowuje utwór w katalogu i zapisuje prośbę. Zwraca gotową odpowiedź dla czatu. */
export async function submitRadioRequest(parsed: ParsedRequest, station: "public" | "vip" = "public"): Promise<SubmitResult> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { ok: false, message: "Zaloguj się, aby zamówić utwór w radiu 🎧" };

  const whenText = parsed.playAt.getTime() - Date.now() < 60_000 ? "od razu" : `o ${fmtTime(parsed.playAt)}`;

  let trackId: string | null = null;
  let title = parsed.title;
  let artist: string | null = null;

  if (parsed.kind === "song") {
    const q = clean(parsed.title);
    const { data } = await supabase
      .from("tracks")
      .select("id,title,artist,audio_url")
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .not("audio_url", "is", null)
      .limit(25);
    const rows = (data ?? []) as { id: string; title: string; artist: string }[];
    const want = parsed.artist?.toLowerCase();
    const hit =
      rows.find((t) => t.title.toLowerCase() === parsed.title.toLowerCase() && (!want || t.artist.toLowerCase().includes(want))) ||
      rows.find((t) => t.title.toLowerCase().includes(parsed.title.toLowerCase()) && (!want || t.artist.toLowerCase().includes(want))) ||
      rows[0];
    if (!hit) {
      return { ok: false, message: `Nie znalazłem „${parsed.title}" w katalogu GrouAI. Podaj wykonawcę (np. „zagraj Wykonawca - Tytuł") albo wklej link z YouTube.` };
    }
    trackId = hit.id;
    title = hit.title;
    artist = hit.artist;
  } else {
    artist = null;
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();

  const { error } = await supabase.from("radio_requests").insert({
    user_id: user.id,
    requester_name: profile?.display_name ?? null,
    station,
    track_id: trackId,
    youtube_id: parsed.kind === "youtube" ? parsed.youtubeId : null,
    title,
    artist,
    play_at: parsed.playAt.toISOString(),
  });
  if (error) {
    const limit = /Limit/i.test(error.message);
    return { ok: false, message: limit ? "Masz już 5 próśb na dziś — spróbuj jutro 🙏" : "Nie udało się zapisać prośby. Spróbuj za chwilę." };
  }

  const who = artist ? `${artist} — ${title}` : title;
  const kind = parsed.kind === "youtube" ? " (wideo z YouTube, otworzy się w oknie radia)" : "";
  return { ok: true, message: `Zamówione! 🎶 „${who}" zagra w radiu ${whenText}${kind}.` };
}

// --- Odczyt nadchodzących próśb (dla radia) ----------------------------------

export interface UpcomingRequest {
  id: string;
  title: string;
  artist: string | null;
  youtube_id: string | null;
  play_at: string;
  station: string;
  requester_name: string | null;
  audio_url: string | null;
}

export async function fetchUpcomingRequests(station: "public" | "vip"): Promise<UpcomingRequest[]> {
  const since = new Date(Date.now() - 3 * 60_000).toISOString();
  const until = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { data } = await supabase
    .from("radio_requests")
    .select("id,title,artist,youtube_id,play_at,station,requester_name,track:tracks(audio_url)")
    .eq("station", station)
    .eq("status", "queued")
    .gte("play_at", since)
    .lte("play_at", until)
    .order("play_at", { ascending: true })
    .limit(100);
  return ((data ?? []) as unknown as (Omit<UpcomingRequest, "audio_url"> & { track: { audio_url: string | null } | null })[]).map((r) => ({
    id: r.id, title: r.title, artist: r.artist, youtube_id: r.youtube_id, play_at: r.play_at,
    station: r.station, requester_name: r.requester_name, audio_url: r.track?.audio_url ?? null,
  }));
}
