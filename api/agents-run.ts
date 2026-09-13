// Harmonogram agentów GrouAI OS BEZ Lovable i BEZ pg_cron — przez Vercel Cron.
// Woła funkcje SQL przez Supabase RPC (anon). Zawsze zbiera odpowiedzi AI
// (brain_reason_collect). Co 2 h robi executive summary; codziennie ~08:00 UTC
// uruchamia Developer + Tester. Wszystko darmowe po stronie Vercela (poza Grok).
/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function handler(req: any, res: any) {
  const URL = process.env.VITE_SUPABASE_URL;
  const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!URL || !ANON) return res.status(200).json({ ok: false, error: "no_supabase_env" });

  const rpc = async (name: string) => {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: "{}",
      });
      const txt = await r.text();
      return { name, status: r.status, body: txt.slice(0, 300) };
    } catch (e) {
      return { name, status: 0, body: String(e) };
    }
  };

  const now = new Date();
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const full = String(req.query?.full || "") === "1";

  const ran: any[] = [];
  // Zawsze: pozbieraj gotowe odpowiedzi AI (Grok) do pamięci.
  ran.push(await rpc("brain_reason_collect"));
  // Co 2 h: executive summary managera.
  if (full || (m < 10 && h % 2 === 0)) ran.push(await rpc("brain_reason"));
  // Codziennie ~08:00 UTC: Developer + Tester.
  if (full || (m < 10 && h === 8)) {
    ran.push(await rpc("developer_agent"));
    ran.push(await rpc("tester_agent"));
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, at: now.toISOString(), ran });
}
