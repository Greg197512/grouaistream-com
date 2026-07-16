// GROUAI HUB — aurora-order-complete
// Domyka zlecenie: wysyła DOKUMENTACJĘ ZAKOŃCZENIA ("co zostało wykonane") mailem
// do ADMINA (grouarock@gmail.com) ORAZ do KLIENTA, i oznacza zlecenie jako completed.
// Wywoływane po potwierdzeniu przez admina, że wszystkie usługi są zrobione.
//
// Wejście: { order_id }  (auth: ?t=<hub_token> lub nagłówek x-hub-token)
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e.trim());

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

const SERVICE_LABELS: Record<string, string> = {
  seo_audit: "Audyt SEO", seo_content: "SEO Content", landing_page: "Landing Page",
  social_post: "Social / TikTok / Reels", automation_flow: "Automatyzacja",
  lead_research: "Lead Research", music_production: "Muzyka / produkcja audio",
  video_edit: "Montaż video", video_ad: "Reklama / klip video",
  graphic_design: "Grafika / branding", other: "Projekt B2B",
};

// Markdown → prosty, czytelny HTML (pełne PL) do raportu.
function mdToHtml(md: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const inline = (t: string) => esc(t).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "$1");
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const t = raw.trim();
    if (!t) { closeList(); continue; }
    if (/^#{1}\s+/.test(t)) { closeList(); out.push(`<h2 style="color:#101010;margin:16px 0 8px">${inline(t.replace(/^#\s+/, ""))}</h2>`); continue; }
    if (/^#{2}\s+/.test(t)) { closeList(); out.push(`<h3 style="color:#FF6B00;margin:14px 0 6px">${inline(t.replace(/^#{2}\s+/, ""))}</h3>`); continue; }
    if (/^#{3,}\s+/.test(t)) { closeList(); out.push(`<h4 style="margin:12px 0 4px">${inline(t.replace(/^#{3,}\s+/, ""))}</h4>`); continue; }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) { closeList(); out.push('<hr style="border:none;border-top:1px solid #eee;margin:14px 0">'); continue; }
    if (/^[-*•]\s+/.test(t)) { if (!inList) { out.push('<ul style="margin:6px 0;padding-left:20px">'); inList = true; } out.push(`<li style="margin:3px 0">${inline(t.replace(/^[-*•]\s+/, ""))}</li>`); continue; }
    const num = t.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (num) { closeList(); out.push(`<p style="margin:6px 0"><strong>${num[1]}.</strong> ${inline(num[2])}</p>`); continue; }
    closeList();
    out.push(`<p style="margin:8px 0;line-height:1.6">${inline(t)}</p>`);
  }
  closeList();
  return out.join("\n");
}

async function sendMail(key: string, from: string, to: string[], subject: string, html: string, replyTo?: string) {
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const b = await r.json().catch(() => ({}));
  return r.ok ? (b?.id ?? "sent") : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  const token = new URL(req.url).searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = String(body.order_id ?? "").trim();
  if (!orderId) return json({ error: "order_id required" }, 400);

  const admin = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const key = cfg["resend_api_key"];
  if (!key) return json({ error: "resend_api_key_missing" }, 200);

  // Zlecenie + wykonana praca
  const { data: lead } = await db.from("hub_leads")
    .select("id, email, name, company, segment, brief, aurora_order_id, meta, status")
    .eq("aurora_order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: deliverable } = await db.from("hub_deliverables")
    .select("service_type, deliverable, model, created_at")
    .eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const serviceType = deliverable?.service_type || lead?.segment || "other";
  const serviceLabel = SERVICE_LABELS[serviceType] ?? "Projekt B2B";
  const clientEmail = lead?.email;
  const clientName = lead?.name || null;
  const workMd = deliverable?.deliverable || "(brak zapisanego materiału — realizacja poza systemem)";
  const doneAt = new Date().toISOString().slice(0, 16).replace("T", " ");

  const bodyHtml = (forClient: boolean) => `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:660px;margin:0 auto">
<div style="border-bottom:3px solid #FF6B00;padding-bottom:10px;margin-bottom:16px">
  <span style="font-weight:700;font-size:16px">Grou<span style="color:#FF6B00">AI</span> Stream</span>
  <span style="display:inline-block;background:#2E7BFF;color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:5px;margin-left:8px;box-shadow:0 0 8px rgba(46,123,255,.6)">B2B</span>
</div>
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Dokumentacja zakończenia · ${esc(orderId)}</p>
<h1 style="font-size:22px;margin:0 0 12px">${forClient ? "Twoje zlecenie zostało zrealizowane ✅" : "Zlecenie zrealizowane — dokumentacja"}</h1>
<table style="border-collapse:collapse;margin:0 0 16px;font-size:14px">
<tr><td style="padding:3px 12px 3px 0;color:#888">Numer zlecenia</td><td style="font-weight:600">${esc(orderId)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#888">Usługa</td><td style="font-weight:600">${esc(serviceLabel)}</td></tr>
${lead?.company ? `<tr><td style="padding:3px 12px 3px 0;color:#888">Firma</td><td style="font-weight:600">${esc(lead.company)}</td></tr>` : ""}
${!forClient && clientEmail ? `<tr><td style="padding:3px 12px 3px 0;color:#888">Klient</td><td style="font-weight:600">${esc(clientName ?? "")} · ${esc(clientEmail)}</td></tr>` : ""}
<tr><td style="padding:3px 12px 3px 0;color:#888">Status</td><td style="font-weight:600;color:#16a34a">ZAKOŃCZONE</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#888">Data</td><td style="font-weight:600">${esc(doneAt)}</td></tr>
</table>
<h2 style="font-size:17px;margin:18px 0 8px">Co zostało wykonane</h2>
<div style="background:#f7f7f7;border-radius:10px;padding:16px 18px">${mdToHtml(workMd)}</div>
<p style="margin:16px 0 6px">${forClient ? "Dziękujemy za zaufanie! Masz pytania lub chcesz kolejne zlecenie — po prostu odpowiedz na tego maila." : "Kopia dokumentacji dla admina. Klient otrzymał tę samą dokumentację na swój e-mail."}</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#888">GrouAI Stream · B2B · <a href="https://grouaistream.com/business" style="color:#FF6B00">grouaistream.com/business</a> · kontakt: ${esc(admin)}</p>
</div>`;

  const results: Record<string, unknown> = {};
  // Admin
  results.admin_mail = await sendMail(key, from, [admin], `✅ Zlecenie zakończone: ${serviceLabel} — ${orderId}`, bodyHtml(false), emailOk(clientEmail) ? clientEmail : undefined);
  // Klient
  if (emailOk(clientEmail)) {
    results.client_mail = await sendMail(key, from, [clientEmail], `Twoje zlecenie ${orderId} zostało zrealizowane — GrouAI Stream`, bodyHtml(true), admin);
  } else {
    results.client_mail = null;
  }

  if (lead?.id) {
    const meta = { ...(lead.meta ?? {}), completed_at: new Date().toISOString() };
    await db.from("hub_leads").update({ status: "completed", meta }).eq("id", lead.id);
  }
  await db.from("hub_log").insert({
    source: "aurora-order-complete", level: "info",
    message: `Dokumentacja zakończenia ${orderId} → admin${results.client_mail ? " + klient" : " (brak maila klienta)"} [${results.admin_mail}/${results.client_mail}]`,
    data: { order_id: orderId, client_email: clientEmail ?? null },
  });

  return json({ ok: true, order_id: orderId, admin: admin, client: clientEmail ?? null, ...results });
});
