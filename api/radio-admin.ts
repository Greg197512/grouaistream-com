// Admin radia BEZ Lovable: przebudowa harmonogramu (public/vip) przez Supabase RPC
// (anon) + odczyt liczby utworów na stacjach. ?do=rebuild uruchamia rebuild_radio_schedules().
/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const URL = process.env.VITE_SUPABASE_URL;
  const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!URL || !ANON) return res.status(200).json({ ok: false, error: "no_env" });
  const H: Record<string, string> = { apikey: ANON, Authorization: `Bearer ${ANON}` };

  let rebuilt: any = null;
  if (String(req.query?.do || "") === "rebuild") {
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/rebuild_radio_schedules`, {
        method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: "{}",
      });
      rebuilt = { status: r.status, body: (await r.text()).slice(0, 200) };
    } catch (e) { rebuilt = { status: 0, body: String(e) }; }
  }

  const count = async (station: string): Promise<number> => {
    try {
      const r = await fetch(`${URL}/rest/v1/radio_schedule?station=eq.${station}&item_type=eq.track&select=track_id&limit=1`,
        { headers: { ...H, Prefer: "count=exact" } });
      const cr = r.headers.get("content-range") || "";
      return parseInt(cr.split("/")[1] || "0", 10);
    } catch { return -1; }
  };
  const vip = await count("vip");
  const pub = await count("public");

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, rebuilt, vip, public: pub });
}
