// GROUAI HUB — capture-lead
// Publiczny endpoint formularza lead-gen dla kampanii Google Ads.
// Legalnie (RODO): zapisuje leada TYLKO z wyraźną zgodą marketingową (consent=true),
// z timestampem zgody i źródłem (gclid/utm). Wysyła mail powitalny przez Resend
// (domena grouarock.com). Dla segmentu B2B odpala aurora-business-intake na LIVE.
//
// Body JSON: {
//   email, name?, segment: "b2b"|"artist"|"listener", company?, brief?,
//   consent: true,                 // WYMAGANE — bez tego 422
//   gclid?, utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?,
//   landing_path?, website?        // website = honeypot (musi być puste)
// }
// Deploy: verify_jwt = false (publiczny formularz; ochrona: honeypot + wymóg zgody).
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEGMENTS = new Set(["b2b", "artist", "listener"]);

const WELCOME: Record<string, { subject: string; html: (name: string) => string }> = {
  b2b: {
    subject: "GrouAI Stream — Twoja bezpłatna wycena jest w drodze 🚀",
    html: (n) => `<h2>Cześć${n ? " " + n : ""}!</h2>
<p>Dziękujemy za kontakt w sprawie usług <b>GrouAI Stream dla firm</b> (SEO, automatyzacje, landing pages, muzyka i radio dla marki).</p>
<p>Nasza asystentka <b>Aurora</b> właśnie przygotowuje wstępną propozycję na podstawie Twojego zgłoszenia — dostaniesz ją na tego maila w ciągu 24 godzin.</p>
<p>W międzyczasie zobacz, co potrafimy: <a href="https://grouaistream.com/business">grouaistream.com/business</a></p>
<p>— Zespół GrouAI Stream</p>`,
  },
  artist: {
    subject: "Witaj w GrouAI Stream — zarabiaj na uczciwym streamingu 🎵",
    html: (n) => `<h2>Hej${n ? " " + n : ""}!</h2>
<p>Super, że chcesz dołączyć jako artysta. U nas <b>każde odsłuchanie jest weryfikowane</b> — zero botów, zero fałszywych streamów, realne wypłaty za prawdziwych fanów.</p>
<p>Załóż konto i wgraj pierwszy utwór: <a href="https://grouaistream.com/upload">grouaistream.com/upload</a></p>
<p>Twoja muzyka może też trafić do <b>Groua Radio</b>, które gra 24/7 w autach i Teslach.</p>
<p>— Zespół GrouAI Stream</p>`,
  },
  listener: {
    subject: "Muzyka, która czyta Twój nastrój — witaj w GrouAI Stream 🎧",
    html: (n) => `<h2>Cześć${n ? " " + n : ""}!</h2>
<p>GrouAI Stream to streaming z AI, które dopasowuje muzykę do Twojego nastroju w czasie rzeczywistym, plus radio na żywo 24/7.</p>
<p>Zacznij słuchać za darmo: <a href="https://grouaistream.com">grouaistream.com</a></p>
<p>— Zespół GrouAI Stream</p>`,
  },
};

async function sendWelcome(cfg: Record<string, string>, to: string, name: string, segment: string): Promise<string | null> {
  const key = cfg["resend_api_key"];
  if (!key) return null;
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const tpl = WELCOME[segment] ?? WELCOME.listener;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: tpl.subject, html: tpl.html(name) }),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok ? (b?.id ?? "sent") : null;
  } catch {
    return null;
  }
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Honeypot — boty wypełniają ukryte pole "website"
  if (body.website) return json({ ok: true, skipped: "bot" }, 200);

  const email = String(body.email ?? "").trim().toLowerCase();
  const segment = SEGMENTS.has(body.segment) ? body.segment : "listener";
  const name = String(body.name ?? "").trim().slice(0, 120);

  if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 422);
  // RODO: bez wyraźnej zgody NIE zapisujemy do marketingu
  if (body.consent !== true) return json({ error: "consent_required" }, 422);

  const ipHash = await sha256((req.headers.get("x-forwarded-for") || "").split(",")[0] + "|" + email);

  const row = {
    email,
    name: name || null,
    segment,
    company: body.company ? String(body.company).slice(0, 160) : null,
    brief: body.brief ? String(body.brief).slice(0, 4000) : null,
    consent_marketing: true,
    consent_at: new Date().toISOString(),
    source: body.source ? String(body.source).slice(0, 40) : "google_ads",
    gclid: body.gclid ? String(body.gclid).slice(0, 200) : null,
    utm_source: body.utm_source ? String(body.utm_source).slice(0, 100) : null,
    utm_medium: body.utm_medium ? String(body.utm_medium).slice(0, 100) : null,
    utm_campaign: body.utm_campaign ? String(body.utm_campaign).slice(0, 150) : null,
    utm_term: body.utm_term ? String(body.utm_term).slice(0, 150) : null,
    utm_content: body.utm_content ? String(body.utm_content).slice(0, 150) : null,
    landing_path: body.landing_path ? String(body.landing_path).slice(0, 200) : null,
    ip_hash: ipHash,
    status: "new",
  };

  // Upsert po (email, segment) — ponowne wysłanie formularza nie tworzy duplikatu
  const { data: existing } = await db
    .from("hub_leads")
    .select("id, status, welcome_email_id")
    .eq("email", email)
    .eq("segment", segment)
    .maybeSingle();

  let leadId: number | null = existing?.id ?? null;
  let isNew = false;
  if (existing) {
    await db.from("hub_leads").update({ ...row, status: existing.status === "unsub" ? "unsub" : existing.status }).eq("id", existing.id);
  } else {
    const { data: ins } = await db.from("hub_leads").insert(row).select("id").single();
    leadId = ins?.id ?? null;
    isNew = true;
  }

  // Mail powitalny (tylko dla nowych lub jeszcze niepowitanych, nie dla wypisanych)
  let welcomeId: string | null = existing?.welcome_email_id ?? null;
  if ((isNew || !welcomeId) && existing?.status !== "unsub") {
    welcomeId = await sendWelcome(cfg, email, name, segment);
    if (welcomeId && leadId) {
      await db.from("hub_leads").update({ welcome_email_id: welcomeId, status: "welcomed" }).eq("id", leadId);
    }
  }

  // B2B → odpal Aurorę na LIVE (best-effort), by przygotowała ofertę
  let auroraOrderId: string | null = null;
  if (segment === "b2b" && cfg["bvstv_anon_key"]) {
    try {
      const liveUrl = cfg["bvstv_url"] || "https://bvstvawnigyczvofzhps.supabase.co";
      const r = await fetch(`${liveUrl}/functions/v1/aurora-business-intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg["bvstv_anon_key"]}` },
        body: JSON.stringify({
          source: "google_ads_lead",
          client_email: email,
          client_name: name || null,
          client_company: row.company,
          service_type: "other",
          brief: row.brief || `Lead z Google Ads (kampania: ${row.utm_campaign ?? "?"}). Skontaktować się z ofertą.`,
          payload: { gclid: row.gclid, utm_campaign: row.utm_campaign, landing: row.landing_path },
        }),
      });
      const jr = await r.json().catch(() => ({}));
      auroraOrderId = jr?.order_id ?? jr?.order?.id ?? null;
      if (auroraOrderId && leadId) {
        await db.from("hub_leads").update({ aurora_order_id: String(auroraOrderId) }).eq("id", leadId);
      }
    } catch { /* best-effort */ }
  }

  await db.from("hub_log").insert({
    source: "capture-lead",
    level: "info",
    message: `Lead ${isNew ? "NOWY" : "ponowny"} [${segment}] ${email}${row.utm_campaign ? ` kampania=${row.utm_campaign}` : ""}${welcomeId ? " ✉mail" : ""}`,
    data: { lead_id: leadId, segment, gclid: row.gclid, aurora_order_id: auroraOrderId },
  });

  return json({
    ok: true,
    lead_id: leadId,
    is_new: isNew,
    welcome_sent: !!welcomeId,
    segment,
    // sygnał do frontu, że można odpalić konwersję Google Ads (gtag)
    fire_conversion: isNew,
  }, 200);
});
