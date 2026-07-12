// GROUAI HUB — hub-email-send: wysyłka maili z panelu admina (Resend).
// Zastępuje martwe funkcje bvstv (send-transactional-email / mass-email-dispatch).
// Admin-only (bvstv has_role). Tryby: single (jeden adres) i mass (wszyscy userzy).
// Klucz: hub_config.resend_api_key, nadawca: hub_config.lead_from_email.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Twarda walidacja e-maila (Resend odrzuca całą partię, jeśli JEDEN adres jest zły).
const emailOk = (e: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Auth: admin LIVE (bvstv).
  const authHeader = req.headers.get("Authorization") ?? "";
  const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
  let userId = "";
  try {
    const { data: u } = await live.auth.getUser();
    if (!u?.user) return json({ success: false, error: "unauthorized" }, 401);
    userId = u.user.id;
    const { data: isAdmin } = await live.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin !== true) return json({ success: false, error: "forbidden (tylko admin)" }, 403);
  } catch {
    return json({ success: false, error: "unauthorized" }, 401);
  }

  const resendKey = cfg["resend_api_key"];
  if (!resendKey) return json({ success: false, error: "resend_api_key nie skonfigurowany na hubie" }, 200);
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";

  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, error: "invalid_json" }, 400); }
  const subject = String(body.subject || "").trim();
  const rawHtml = String(body.html || body.body || "").trim();
  const mode = body.mode === "mass" ? "mass" : "single";
  if (!subject || !rawHtml) return json({ success: false, error: "Brak tematu lub treści" }, 200);

  // Odbiorcy
  let recipients: string[] = [];
  let skipped = 0;
  if (mode === "single") {
    const to = String(body.to || "").trim();
    if (!to || !emailOk(to)) return json({ success: false, error: "Podaj poprawny adres odbiorcy" }, 200);
    recipients = [to];
  } else {
    try {
      const { data: users, error: uErr } = await live.rpc("get_all_users_for_admin");
      if (uErr) return json({ success: false, error: "Nie udało się pobrać listy userów: " + uErr.message }, 200);
      const all = (users || []).map((u: any) => String(u.email || "").trim().toLowerCase());
      const valid = all.filter((e: string) => emailOk(e));
      skipped = all.length - valid.length; // ile adresów pominięto jako niepoprawne
      recipients = [...new Set(valid)];
    } catch (e) {
      return json({ success: false, error: "Błąd listy odbiorców: " + String(e).slice(0, 120) }, 200);
    }
  }
  if (!recipients.length) return json({ success: false, error: "Brak poprawnych odbiorców (wszystkie adresy odrzucone)" }, 200);

  const htmlDoc = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px;margin:0 auto">${rawHtml}<hr style="border:none;border-top:1px solid #eee;margin:24px 0"><p style="font-size:12px;color:#888">GrouAI Stream · <a href="https://grouaistream.com" style="color:#FF6B00">grouaistream.com</a></p></div>`;

  // Wysyłka przez Resend. Batch do 100/req; jeśli partia padnie — ślij pojedynczo
  // (żeby jeden problematyczny adres nie zabił całej wysyłki).
  const rHeaders = { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" };
  let sent = 0, errors = 0, firstErr = "";

  const sendOne = async (to: string): Promise<boolean> => {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: rHeaders,
        body: JSON.stringify({ from, to, subject, html: htmlDoc }),
      });
      if (r.ok) return true;
      const d = await r.json().catch(() => null);
      if (!firstErr) firstErr = (d && (d.message || d.name)) ? `${d.name || ""} ${d.message || ""}`.trim() : `Resend HTTP ${r.status}`;
      return false;
    } catch (e) {
      if (!firstErr) firstErr = String(e).slice(0, 140);
      return false;
    }
  };

  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    let batchOk = false;
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: rHeaders,
        body: JSON.stringify(chunk.map((to) => ({ from, to, subject, html: htmlDoc }))),
      });
      if (r.ok) { batchOk = true; sent += chunk.length; }
      else {
        const d = await r.json().catch(() => null);
        if (!firstErr) firstErr = (d && (d.message || d.name)) ? `${d.name || ""} ${d.message || ""}`.trim() : `Resend HTTP ${r.status}`;
      }
    } catch (e) {
      if (!firstErr) firstErr = String(e).slice(0, 140);
    }

    if (!batchOk) {
      firstErr = ""; // per-adres damy dokładniejszy błąd
      for (const to of chunk) {
        if (await sendOne(to)) sent++; else errors++;
        await new Promise((res) => setTimeout(res, 550));
      }
    }
    if (recipients.length > 100 && i + 100 < recipients.length) await new Promise((res) => setTimeout(res, 700));
  }

  // Log zbiorczy do email_send_log (best-effort).
  try {
    await live.from("email_send_log").insert({
      message_id: crypto.randomUUID(),
      template_name: subject.slice(0, 80),
      recipient_email: mode === "single" ? recipients[0] : `mass: ${recipients.length} odbiorców`,
      status: sent > 0 ? "sent" : "failed",
      error_message: sent > 0 ? null : firstErr.slice(0, 200),
    });
  } catch { /* log opcjonalny */ }

  return json({
    success: sent > 0,
    recipientCount: recipients.length,
    queued: sent,
    sent,
    errors,
    skipped,
    subject,
    mode,
    error: sent > 0 ? undefined : (firstErr || "Nie wysłano — sprawdź Resend"),
  });
});
