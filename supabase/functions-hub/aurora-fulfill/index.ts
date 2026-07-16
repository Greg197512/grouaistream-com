// GROUAI HUB — aurora-fulfill
// Autonomiczna realizacja zleceń media przez Replicate — z bramką admina.
//
// Przepływ (bez człowieka poza JEDNYM kliknięciem admina):
//  1) phase=notify (cron co 3 min, auth hub_token): znajduje zlecenia ze statusem
//     "payment_reported" bez wysłanego zatwierdzenia → mail do admina z przyciskiem
//     "POTWIERDZAM — uruchom realizację" (link z kluczem per-zlecenie).
//  2) GET ?order=&k= (klik admina): weryfikuje klucz → startuje predykcję Replicate
//     (muzyka / wideo / grafika wg service_type) z webhookiem zwrotnym; usługi
//     nie-mediowe od razu domyka przez aurora-order-complete.
//  3) POST ?phase=cb&order=&k= (webhook Replicate): zapisuje wynik (linki do plików)
//     w hub_deliverables, wysyła pliki mailem do KLIENTA i ADMINA, woła
//     aurora-order-complete (dokumentacja zakończenia do obu).
//
// Klucz zatwierdzenia: sha256(hub_token + ":approve:" + orderId) hex[0..32] —
// deterministyczny, nieodgadywalny bez hub_token, bez dodatkowej tabeli.
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const page = (title: string, msg: string, ok = true) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0b0f;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:520px;padding:40px;text-align:center"><div style="font-weight:700;font-size:18px;margin-bottom:6px">Grou<span style="color:#FF6B00">AI</span> Stream <span style="background:#2E7BFF;color:#fff;font-size:11px;padding:2px 8px;border-radius:5px;box-shadow:0 0 10px rgba(46,123,255,.7)">B2B</span></div><h1 style="font-size:22px;color:${ok ? "#4ade80" : "#f87171"}">${title}</h1><p style="line-height:1.6;color:#bbb">${msg}</p></div></body>`,
    { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } },
  );

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e.trim());
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

const SERVICE_LABELS: Record<string, string> = {
  music_production: "Muzyka / produkcja audio", video_edit: "Montaż video",
  video_ad: "Reklama / klip video", graphic_design: "Grafika / branding",
  seo_audit: "Audyt SEO", seo_content: "SEO Content", landing_page: "Landing Page",
  social_post: "Social / TikTok / Reels", automation_flow: "Automatyzacja",
  lead_research: "Lead Research", other: "Projekt B2B",
};
// Usługi z realną generacją mediów przez Replicate.
const MEDIA_MODELS: Record<string, (cfg: Record<string, string>, brief: string) => { model: string; input: Record<string, unknown> }> = {
  music_production: (cfg, brief) => ({
    model: cfg["vocal_model"] || "minimax/music-2.6",
    // Brief zawiera tagi [Verse]/[Chorus] → traktujemy jako tekst utworu; inaczej instrumental.
    input: /\[(verse|chorus|intro|bridge|outro|hook)/i.test(brief)
      ? { lyrics: brief.slice(0, 3400), prompt: "", is_instrumental: false, audio_format: "mp3" }
      : { prompt: brief.slice(0, 1900), is_instrumental: true, audio_format: "mp3" },
  }),
  video_ad: (cfg, brief) => ({ model: cfg["video_model_good"] || "lightricks/ltx-video", input: { prompt: brief.slice(0, 1900) } }),
  video_edit: (cfg, brief) => ({ model: cfg["video_model_good"] || "lightricks/ltx-video", input: { prompt: brief.slice(0, 1900) } }),
  graphic_design: (cfg, brief) => ({ model: cfg["image_model"] || "black-forest-labs/flux-schnell", input: { prompt: brief.slice(0, 1900) } }),
};

async function approveKey(hubToken: string, orderId: string): Promise<string> {
  const data = new TextEncoder().encode(`${hubToken}:approve:${orderId}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function sendMail(key: string, from: string, to: string[], subject: string, html: string, replyTo?: string) {
  const payload: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok ? (b?.id ?? "sent") : null;
  } catch { return null; }
}

function brandHeader(): string {
  return `<div style="border-bottom:3px solid #FF6B00;padding-bottom:10px;margin-bottom:16px">
<span style="font-weight:700;font-size:16px">Grou<span style="color:#FF6B00">AI</span> Stream</span>
<span style="display:inline-block;background:#2E7BFF;color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:5px;margin-left:8px;box-shadow:0 0 8px rgba(46,123,255,.6)">B2B</span>
</div>`;
}

async function callOrderComplete(baseUrl: string, hubToken: string, orderId: string) {
  try {
    const r = await fetch(`${baseUrl}/functions/v1/aurora-order-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hub-token": hubToken },
      body: JSON.stringify({ order_id: orderId }),
    });
    return r.status;
  } catch { return 0; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";
  const hubToken = cfg["hub_token"] || "";
  const admin = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const resend = cfg["resend_api_key"];
  const baseUrl = Deno.env.get("SUPABASE_URL")!;

  const url = new URL(req.url);
  const phase = url.searchParams.get("phase") || "";

  // ── 1) NOTIFY: cron znajduje zgłoszone wpłaty i mailuje adminowi przycisk zatwierdzenia ──
  if (phase === "notify" && req.method === "POST") {
    const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
    if (!hubToken || token !== hubToken) return json({ error: "unauthorized" }, 401);
    const { data: leads } = await db.from("hub_leads")
      .select("id, email, name, company, segment, brief, aurora_order_id, meta")
      .eq("status", "payment_reported").limit(10);
    const pending = (leads || []).filter((l: any) => l.aurora_order_id && !(l.meta?.approval_sent));
    let sent = 0;
    for (const lead of pending) {
      const orderId = lead.aurora_order_id as string;
      const k = await approveKey(hubToken, orderId);
      const approveUrl = `${baseUrl}/functions/v1/aurora-fulfill?order=${encodeURIComponent(orderId)}&k=${k}`;
      const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
      const isMedia = !!MEDIA_MODELS[lead.segment];
      const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Wpłata zgłoszona · wymagane potwierdzenie</p>
<h2 style="margin:0 0 12px">Zlecenie ${esc(orderId)} — ${esc(label)}</h2>
<p style="margin:0 0 6px"><strong>Klient:</strong> ${esc(lead.name ?? "—")} ${lead.company ? "(" + esc(lead.company) + ")" : ""} · ${esc(lead.email ?? "—")}</p>
<p style="margin:0 0 6px;color:#888;font-size:13px">Brief:</p>
<div style="background:#f6f6f6;border-radius:8px;padding:12px 14px;white-space:pre-wrap">${esc(String(lead.brief ?? "").slice(0, 900))}</div>
<p style="margin:16px 0 6px">Sprawdź wpływ na koncie (Revolut REVOLT21). Gdy się zgadza, kliknij — Aurora ${isMedia ? "od razu wygeneruje media (Replicate) i" : ""} wyśle klientowi wynik oraz dokumentację zakończenia:</p>
<p style="margin:14px 0"><a href="${approveUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;display:inline-block;font-weight:700;font-size:16px">✅ POTWIERDZAM — uruchom realizację</a></p>
<p style="font-size:12px;color:#888;margin:14px 0 0">Link jest jednorazowy dla tego zlecenia. Jeśli wpłaty nie widać — po prostu zignoruj tego maila.</p>
</div>`;
      const mailId = resend ? await sendMail(resend, from, [admin], `💳 Potwierdź realizację: ${label} — ${orderId}`, html, emailOk(lead.email) ? lead.email : undefined) : null;
      if (mailId) {
        const meta = { ...(lead.meta ?? {}), approval_sent: new Date().toISOString() };
        await db.from("hub_leads").update({ meta }).eq("id", lead.id);
        sent++;
      }
      await db.from("hub_log").insert({
        source: "aurora-fulfill", level: mailId ? "info" : "error",
        message: mailId ? `Prośba o zatwierdzenie ${orderId} → admin [${mailId}]` : `NIE wysłano prośby o zatwierdzenie ${orderId}`,
        data: { order_id: orderId },
      });
    }
    return json({ ok: true, pending: pending.length, sent });
  }

  // ── 3) CB: webhook Replicate z gotowym wynikiem ──
  if (phase === "cb" && req.method === "POST") {
    const orderId = url.searchParams.get("order") || "";
    const k = url.searchParams.get("k") || "";
    if (!orderId || !hubToken || k !== await approveKey(hubToken, orderId)) return json({ error: "unauthorized" }, 401);

    let pred: any;
    try { pred = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const status = String(pred?.status ?? "");
    const { data: lead } = await db.from("hub_leads")
      .select("id, email, name, segment, meta").eq("aurora_order_id", orderId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const label = SERVICE_LABELS[lead?.segment ?? ""] ?? "Projekt B2B";

    if (status !== "succeeded") {
      const err = String(pred?.error ?? status).slice(0, 300);
      await db.from("hub_log").insert({
        source: "aurora-fulfill", level: "error",
        message: `Generacja ${orderId} nieudana (${status}): ${err}`, data: { order_id: orderId },
      });
      if (resend) {
        await sendMail(resend, from, [admin], `⚠️ Generacja nieudana: ${orderId}`,
          `<div style="font-family:sans-serif">${brandHeader()}<p>Replicate zwrócił status <strong>${esc(status)}</strong> dla zlecenia ${esc(orderId)} (${esc(label)}).</p><div style="background:#fef2f2;border-radius:8px;padding:12px">${esc(err)}</div><p>Model: ${esc(pred?.model ?? "?")}. Popraw brief/model i kliknij link zatwierdzenia ponownie.</p></div>`);
      }
      // pozwól spróbować ponownie
      if (lead?.id) {
        const meta = { ...(lead.meta ?? {}) }; delete meta.fulfill_started;
        await db.from("hub_leads").update({ meta }).eq("id", lead.id);
      }
      return json({ ok: true, noted: "failed" });
    }

    // Wynik: string | string[] | obiekt z url-ami
    const out = pred?.output;
    const files: string[] = (Array.isArray(out) ? out : [out])
      .flat().map((x: any) => typeof x === "string" ? x : (x?.url ?? "")).filter((u: string) => /^https?:\/\//.test(u));
    const linksMd = files.map((u, i) => `- Plik ${i + 1}: ${u}`).join("\n");
    const deliverableMd = `# ${label} — wynik realizacji\n\nZlecenie: ${orderId}\nModel: ${pred?.model ?? "Replicate"}\n\n## Pliki do pobrania\n${linksMd || "- (brak plików w odpowiedzi)"}\n\nLinki Replicate wygasają po pewnym czasie — pobierz pliki od razu.`;

    await db.from("hub_deliverables").insert({
      order_id: orderId, service_type: lead?.segment ?? "other",
      brief: String(lead?.meta?.brief ?? "").slice(0, 4000) || null,
      deliverable: deliverableMd, model: String(pred?.model ?? "replicate"),
    });

    const linksHtml = files.map((u, i) => `<p style="margin:6px 0"><a href="${esc(u)}" style="color:#FF6B00;font-weight:600">⬇ Pobierz plik ${i + 1}</a></p>`).join("");
    const clientEmail = emailOk(lead?.email) ? (lead!.email as string) : null;
    const resultHtml = (forClient: boolean) => `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:620px;margin:0 auto">
${brandHeader()}
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Realizacja gotowa · ${esc(orderId)}</p>
<h1 style="font-size:22px;margin:0 0 12px">${forClient ? "Twoje pliki są gotowe 🎉" : `Wynik realizacji ${esc(orderId)}`}</h1>
<p style="margin:0 0 10px"><strong>Usługa:</strong> ${esc(label)}</p>
${linksHtml || "<p>(brak plików)</p>"}
<p style="margin:14px 0 0;font-size:13px;color:#888">Pobierz pliki od razu — linki po pewnym czasie wygasają. ${forClient ? "Za chwilę dostaniesz też dokumentację zakończenia zlecenia." : ""}</p>
</div>`;
    if (resend) {
      if (clientEmail) await sendMail(resend, from, [clientEmail], `Twoje pliki gotowe — ${label} (${orderId})`, resultHtml(true), admin);
      await sendMail(resend, from, [admin], `🎉 Wygenerowano: ${label} — ${orderId}`, resultHtml(false), clientEmail ?? undefined);
    }
    if (lead?.id) {
      const meta = { ...(lead.meta ?? {}), fulfilled_at: new Date().toISOString(), files };
      await db.from("hub_leads").update({ meta }).eq("id", lead.id);
    }
    const ocStatus = await callOrderComplete(baseUrl, hubToken, orderId);
    await db.from("hub_log").insert({
      source: "aurora-fulfill", level: "info",
      message: `Generacja ${orderId} gotowa (${files.length} plik.) → klient+admin, order-complete [${ocStatus}]`,
      data: { order_id: orderId, files },
    });
    return json({ ok: true });
  }

  // ── 2) APPROVE: klik admina w mailu ──
  if (req.method === "GET") {
    const orderId = url.searchParams.get("order") || "";
    const k = url.searchParams.get("k") || "";
    if (!orderId || !hubToken || k !== await approveKey(hubToken, orderId)) {
      return page("Nieprawidłowy link", "Link zatwierdzenia jest niepoprawny lub wygasł.", false);
    }
    const { data: lead } = await db.from("hub_leads")
      .select("id, email, name, segment, brief, meta, status").eq("aurora_order_id", orderId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!lead) return page("Nie znaleziono zlecenia", `Zlecenie ${esc(orderId)} nie istnieje w systemie.`, false);
    if (lead.meta?.fulfilled_at) return page("Już zrealizowane", `Zlecenie ${esc(orderId)} zostało już wykonane — pliki wysłano mailem.`);
    if (lead.meta?.fulfill_started) return page("Już uruchomione", `Realizacja ${esc(orderId)} już trwa. Wynik przyjdzie mailem do klienta i do Ciebie.`);

    const label = SERVICE_LABELS[lead.segment] ?? "Projekt B2B";
    const media = MEDIA_MODELS[lead.segment];

    if (!media) {
      // Usługa nie-mediowa: materiał (oferta/plan) już istnieje w hub_deliverables — domykamy.
      const meta = { ...(lead.meta ?? {}), fulfill_started: new Date().toISOString(), fulfilled_at: new Date().toISOString() };
      await db.from("hub_leads").update({ meta }).eq("id", lead.id);
      const ocStatus = await callOrderComplete(baseUrl, hubToken, orderId);
      await db.from("hub_log").insert({
        source: "aurora-fulfill", level: "info",
        message: `Zatwierdzono ${orderId} (${lead.segment}) — bez mediów, order-complete [${ocStatus}]`,
        data: { order_id: orderId },
      });
      return page("Potwierdzono ✅", `Zlecenie ${esc(orderId)} (${esc(label)}) oznaczone jako zrealizowane. Dokumentacja zakończenia poszła mailem do klienta i do Ciebie.`);
    }

    // Media: startujemy predykcję Replicate z webhookiem zwrotnym.
    const replicate = cfg["replicate_api_token"];
    if (!replicate) return page("Brak klucza Replicate", "Dodaj replicate_api_token w hub_config i kliknij ponownie.", false);
    const { model, input } = media(cfg, String(lead.brief ?? ""));
    const webhook = `${baseUrl}/functions/v1/aurora-fulfill?phase=cb&order=${encodeURIComponent(orderId)}&k=${k}`;
    let resp: Response;
    try {
      resp = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${replicate}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input, webhook, webhook_events_filter: ["completed"] }),
      });
    } catch (e) {
      return page("Błąd połączenia", `Nie udało się połączyć z Replicate: ${esc(String(e).slice(0, 160))}`, false);
    }
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body?.id) {
      const err = String(body?.detail ?? body?.error ?? resp.status).slice(0, 240);
      await db.from("hub_log").insert({
        source: "aurora-fulfill", level: "error",
        message: `Start generacji ${orderId} [${model}] nieudany: ${err}`, data: { order_id: orderId },
      });
      return page("Błąd startu generacji", `Replicate odrzucił zadanie (${esc(model)}): ${esc(err)}`, false);
    }
    const meta = { ...(lead.meta ?? {}), fulfill_started: new Date().toISOString(), prediction_id: body.id, prediction_model: model, brief: String(lead.brief ?? "").slice(0, 4000) };
    await db.from("hub_leads").update({ meta }).eq("id", lead.id);
    await db.from("hub_log").insert({
      source: "aurora-fulfill", level: "info",
      message: `Zatwierdzono ${orderId} → generacja [${model}] pred=${body.id}`,
      data: { order_id: orderId, prediction_id: body.id },
    });
    return page("Realizacja uruchomiona 🚀", `Aurora generuje ${esc(label)} dla zlecenia ${esc(orderId)} (model ${esc(model)}). Gotowe pliki przyjdą mailem do klienta i do Ciebie, razem z dokumentacją zakończenia. Możesz zamknąć tę stronę.`);
  }

  return json({ error: "not_found" }, 404);
});
