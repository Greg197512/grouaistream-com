// Strażnik strony GrouAI — jeden bot, który pilnuje, żeby nic nie blokowało strony.
// Działa na Vercelu (nie zależy od kredytów Lovable). Wołany z /api/agents-run co 10 min.
// Sprawdza: stronę, bazę (utwory), plik audio na R2, hub. Przy awarii ponawia
// (auto-naprawa: rozbudzenie bazy kolejnymi zapytaniami) i alarmuje na Telegram,
// jeśli ustawione TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID w Vercel.
/* eslint-disable @typescript-eslint/no-explicit-any */

type Check = { name: string; ok: boolean; ms: number; detail?: string };

async function probe(name: string, url: string, init: RequestInit = {}, okFn?: (r: Response, body: string) => boolean): Promise<Check> {
  const t = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    const body = init.method === "HEAD" ? "" : (await r.text()).slice(0, 2000);
    const ok = okFn ? okFn(r, body) : r.ok;
    return { name, ok, ms: Date.now() - t, detail: ok ? undefined : `HTTP ${r.status} ${body.slice(0, 120)}` };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t, detail: String(e).slice(0, 120) };
  }
}

export async function runGuardian(): Promise<{ ok: boolean; checks: Check[]; healed: string[] }> {
  const SB = process.env.VITE_SUPABASE_URL;
  const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const SITE = process.env.SITE_URL || "https://grouaistream.com";
  const R2 = "https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev";
  const healed: string[] = [];

  const dbCheck = () =>
    probe("baza_utwory", `${SB}/rest/v1/tracks?select=id,audio_url&limit=1`, {
      headers: { apikey: ANON!, Authorization: `Bearer ${ANON}` },
    }, (r, b) => r.ok && b.startsWith("["));

  const checks: Check[] = await Promise.all([
    probe("strona", SITE, {}, (r, b) => r.ok && b.includes("<div id=\"root\"")),
    SB && ANON ? dbCheck() : Promise.resolve({ name: "baza_utwory", ok: false, ms: 0, detail: "brak env" }),
    probe("hub", "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/hub-status"),
  ]);

  // Auto-naprawa bazy: uśpiona baza budzi się po kilku zapytaniach.
  const dbIdx = checks.findIndex((c) => c.name === "baza_utwory");
  if (!checks[dbIdx].ok && SB && ANON) {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
      const again = await dbCheck();
      if (again.ok) { checks[dbIdx] = again; healed.push(`baza obudzona (próba ${i + 1})`); break; }
    }
  }

  // Plik audio z R2 (pierwszy utwór z bazy).
  if (checks[dbIdx].ok && SB && ANON) {
    try {
      const r = await fetch(`${SB}/rest/v1/tracks?select=audio_url&audio_url=like.${encodeURIComponent(R2)}*&limit=1`, {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      });
      const rows = await r.json();
      if (rows?.[0]?.audio_url) checks.push(await probe("r2_audio", rows[0].audio_url, { headers: { Range: "bytes=0-1" } }, (x) => x.status === 206 || x.ok));
    } catch { /* pomiń */ }
  }

  const ok = checks.every((c) => c.ok);
  const bad = checks.filter((c) => !c.ok);
  const tg = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (bad.length && tg && chat) {
    const text = `🚨 Strażnik GrouAI: problem\n${bad.map((c) => `• ${c.name}: ${c.detail}`).join("\n")}`;
    await fetch(`https://api.telegram.org/bot${tg}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    }).catch(() => {});
  }
  return { ok, checks, healed };
}

export default async function handler(_req: any, res: any) {
  const result = await runGuardian();
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ at: new Date().toISOString(), ...result });
}
