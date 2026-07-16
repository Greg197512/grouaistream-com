// GROUAI HUB — aurora-outreach
// Bot partnerstw B2B: sam wyszukuje firmy do współpracy (DuckDuckGo), wchodzi na ich
// strony, zbiera publiczne kontakty firmowe, a po JEDNYM kliknięciu admina wysyła
// spersonalizowane (AI) propozycje współpracy. Odpowiedzi trafiają na grouarock@gmail.com.
//
// Fazy:
//  - POST ?phase=find (cron/tydzień lub ręcznie, auth hub_token):
//      nisze z hub_config.outreach_niches → szukaj firm → zapisz hub_partners →
//      digest z przyciskiem "WYŚLIJ PROPOZYCJE" do admina.
//  - GET ?approve=1&k=<klucz dnia>: klik admina → do 15 firm ze statusem "found"
//      idzie spersonalizowany mail partnerski (AI, fallback szablon), status→contacted.
//
// Zasady: tylko publiczne adresy firmowe ze stron WWW, max 15 maili na zatwierdzenie,
// stopka z możliwością rezygnacji (STOP), reply-to = admin. Deploy: verify_jwt=false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
const page = (title: string, msg: string, ok = true) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:-apple-system,Segoe UI,sans-serif;background:#0b0b0f;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="max-width:560px;padding:40px;text-align:center"><div style="font-weight:700;font-size:18px;margin-bottom:6px">Grou<span style="color:#FF6B00">AI</span> Stream <span style="background:#2E7BFF;color:#fff;font-size:11px;padding:2px 8px;border-radius:5px;box-shadow:0 0 10px rgba(46,123,255,.7)">B2B</span></div><h1 style="font-size:22px;color:${ok ? "#4ade80" : "#f87171"}">${title}</h1><div style="line-height:1.6;color:#bbb;text-align:left">${msg}</div></div></body>`,
    { headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } },
  );

const OWN_DOMAINS = ["grouaistream.com", "grouarock.com", "duckduckgo.com", "google.com", "facebook.com", "instagram.com", "youtube.com", "linkedin.com", "wikipedia.org", "allegro.pl", "olx.pl"];
const BAD_EMAIL = /(example|sentry|wixpress|godaddy|cloudflare|\.png|\.jpg|\.gif|\.webp|\.svg|noreply|no-reply|@[0-9.]+$)/i;

async function fetchText(url: string, ms: number): Promise<string> {
  try {
    const r = await fetch(url, {
      redirect: "follow", signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36" },
    });
    if (!r.ok) return "";
    return (await r.text()).slice(0, 350_000);
  } catch { return ""; }
}

// Szukajka: DuckDuckGo HTML (bez klucza) — wyciąga adresy stron firm z wyników.
async function searchCompanies(query: string): Promise<string[]> {
  const urls = new Set<string>();
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=pl-pl`, 15000);
  for (const m of html.matchAll(/uddg=([^&"']+)/g)) {
    try { urls.add(decodeURIComponent(m[1])); } catch { /**/ }
  }
  if (!urls.size) { // fallback: wersja lite
    const lite = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=pl-pl`, 15000);
    for (const m of lite.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
      if (!/duckduckgo/i.test(m[1])) urls.add(m[1]);
    }
  }
  const domains = new Map<string, string>();
  for (const u of urls) {
    try {
      const h = new URL(u).hostname.replace(/^www\./, "");
      if (OWN_DOMAINS.some((d) => h === d || h.endsWith("." + d))) continue;
      if (!domains.has(h)) domains.set(h, u);
    } catch { /**/ }
  }
  return [...domains.values()].slice(0, 10);
}

// Wejdź na stronę firmy: nazwa (title) + publiczny e-mail firmowy (mailto / tekst, też /kontakt).
async function inspectCompany(url: string): Promise<{ name: string | null; email: string | null; title: string | null }> {
  const home = await fetchText(url, 12000);
  const pickEmail = (html: string): string | null => {
    const found = new Set<string>();
    for (const m of html.matchAll(/mailto:([^"'?\s<>]+)/gi)) found.add(m[1].toLowerCase());
    for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,10}/gi)) found.add(m[0].toLowerCase());
    const clean = [...found].filter((e) => !BAD_EMAIL.test(e) && e.length < 60);
    const pref = clean.find((e) => /^(kontakt|biuro|office|hello|info|contact|hi|studio)@/.test(e));
    return pref ?? clean[0] ?? null;
  };
  const title = (home.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, " ").trim().slice(0, 120) ?? null;
  let email = pickEmail(home);
  if (!email) {
    const origin = new URL(url).origin;
    for (const path of ["/kontakt", "/contact", "/kontakt/", "/contact/", "/o-nas", "/about"]) {
      const sub = await fetchText(origin + path, 8000);
      email = pickEmail(sub);
      if (email) break;
    }
  }
  const name = title ? title.split(/[|–—-]/)[0].trim().slice(0, 80) : null;
  return { name, email, title };
}

async function dayKey(hubToken: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${hubToken}:outreach:${day}`);
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

// Spersonalizowana propozycja współpracy — AI z fallbackiem na szablon.
async function proposalFor(cfg: Record<string, string>, p: { name: string | null; domain: string; niche: string; title: string | null }): Promise<{ subject: string; text: string }> {
  const company = p.name || p.domain;
  const fallback = {
    subject: `Propozycja współpracy — GrouAI Stream x ${company}`,
    text: `Dzień dobry,\n\npiszę z GrouAI Stream (grouaistream.com) — platformy muzycznej AI z działem usług B2B: SEO i content, landing pages, produkcja muzyki i audio (jingle, podkłady, lektor), montaż i reklamy video, automatyzacje.\n\nTrafiłem na ${company} i myślę, że moglibyśmy nawzajem podsyłać sobie klientów albo połączyć siły przy projektach (${p.niche}). Współpracujemy elastycznie: podwykonawstwo, pakiety dla Waszych klientów albo wspólne oferty.\n\nJeśli to ciekawe — po prostu odpowiedz na tego maila, umówimy krótką rozmowę.\n\nPozdrawiam,\nGrzegorz Karon\nGrouAI Stream · grouaistream.com/business`,
  };
  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) return fallback;
  const models = (cfg["openrouter_models"] || "google/gemini-2.5-flash").split(",").map((m) => m.trim()).filter(Boolean);
  for (const model of models) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Outreach" },
        body: JSON.stringify({
          model, max_tokens: 500, temperature: 0.7,
          messages: [
            { role: "system", content: `Piszesz krótkie, ciepłe, profesjonalne maile B2B po polsku w imieniu GrouAI Stream (grouaistream.com — platforma muzyczna AI + usługi B2B: SEO, content, landing pages, muzyka/audio na zamówienie, montaż i reklamy video, automatyzacje). Cel: propozycja WSPÓŁPRACY partnerskiej (wymiana klientów, podwykonawstwo, wspólne pakiety) — nie sprzedaż wprost. Max 120 słów, bez ściemy, konkretnie, po jednym nawiązaniu do firmy odbiorcy. Podpis: Grzegorz Karon, GrouAI Stream. Zwróć czysty JSON: {"subject":"...","text":"..."}` },
            { role: "user", content: `Firma: ${company}\nDomena: ${p.domain}\nTytuł ich strony: ${p.title ?? "?"}\nNisza: ${p.niche}` },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) continue;
      const out = await r.json();
      const c = out.choices?.[0]?.message?.content ?? "";
      const m = c.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.subject && parsed.text) return { subject: String(parsed.subject).slice(0, 120), text: String(parsed.text).slice(0, 2000) };
      }
    } catch { /* następny model */ }
  }
  return fallback;
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

  // ── FIND: szukaj firm w niszach, zapisz, wyślij digest adminowi ──
  if (url.searchParams.get("phase") === "find" && req.method === "POST") {
    const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
    if (!hubToken || token !== hubToken) return json({ error: "unauthorized" }, 401);
    let body: any = {};
    try { body = await req.json(); } catch { /* opcjonalne */ }
    const niches = (body.niche ? [String(body.niche)] : (cfg["outreach_niches"] || "agencja marketingowa Polska").split(",").map((n) => n.trim()).filter(Boolean)).slice(0, 3);

    const found: Array<{ niche: string; name: string | null; domain: string; url: string; email: string | null }> = [];
    for (const niche of niches) {
      const sites = await searchCompanies(`${niche} kontakt`);
      for (const siteUrl of sites.slice(0, 6)) {
        const domain = new URL(siteUrl).hostname.replace(/^www\./, "");
        const { data: existing } = await db.from("hub_partners").select("id").eq("domain", domain.toLowerCase()).maybeSingle();
        if (existing) continue;
        const info = await inspectCompany(siteUrl);
        const row = { niche, name: info.name, domain: domain.toLowerCase(), url: siteUrl, email: info.email, status: "found", meta: { title: info.title } };
        const { error } = await db.from("hub_partners").insert(row);
        if (!error) found.push({ niche, name: info.name, domain, url: siteUrl, email: info.email });
      }
    }

    const withEmail = found.filter((f) => f.email);
    if (withEmail.length && resend) {
      const k = await dayKey(hubToken);
      const approveUrl = `${baseUrl}/functions/v1/aurora-outreach?approve=1&k=${k}`;
      const rows = withEmail.map((f) => `<tr><td style="padding:5px 10px 5px 0;font-weight:600">${esc(f.name ?? f.domain)}</td><td style="padding:5px 10px 5px 0"><a href="${esc(f.url)}" style="color:#FF6B00">${esc(f.domain)}</a></td><td style="padding:5px 0">${esc(f.email)}</td></tr>`).join("");
      const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:640px;margin:0 auto">
<div style="border-bottom:3px solid #FF6B00;padding-bottom:10px;margin-bottom:16px"><span style="font-weight:700;font-size:16px">Grou<span style="color:#FF6B00">AI</span> Stream</span> <span style="display:inline-block;background:#2E7BFF;color:#fff;font-weight:700;font-size:11px;padding:2px 8px;border-radius:5px;margin-left:8px;box-shadow:0 0 8px rgba(46,123,255,.6)">B2B</span></div>
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#2E7BFF;margin:0 0 4px">Aurora Outreach · nowi partnerzy do kontaktu</p>
<h2 style="margin:0 0 12px">Znalazłam ${withEmail.length} firm z kontaktem (${esc(niches.join(", "))})</h2>
<table style="border-collapse:collapse;font-size:13px;margin:0 0 16px">${rows}</table>
<p style="margin:0 0 6px">Klik = Aurora wyśle każdej z nich spersonalizowaną propozycję współpracy (odpowiedzi przyjdą na ${esc(admin)}):</p>
<p style="margin:14px 0"><a href="${approveUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 26px;border-radius:10px;display:inline-block;font-weight:700;font-size:16px">📨 WYŚLIJ PROPOZYCJE WSPÓŁPRACY</a></p>
<p style="font-size:12px;color:#888">Link ważny dziś. Nisze do szukania zmienisz w hub_config → outreach_niches. Firmy bez maila zapisałam w bazie (hub_partners) do ręcznego kontaktu.</p>
</div>`;
      await sendMail(resend, from, [admin], `🤝 Aurora znalazła ${withEmail.length} firm do współpracy`, html);
    }
    await db.from("hub_log").insert({
      source: "aurora-outreach", level: "info",
      message: `Szukanie partnerów [${niches.join("; ")}]: ${found.length} nowych, ${withEmail.length} z e-mailem${withEmail.length ? " → digest do admina" : ""}`,
    });
    return json({ ok: true, found: found.length, with_email: withEmail.length, niches });
  }

  // ── APPROVE: klik admina — wyślij propozycje do firm "found" z e-mailem ──
  if (url.searchParams.get("approve") === "1" && req.method === "GET") {
    const k = url.searchParams.get("k") || "";
    if (!hubToken || k !== await dayKey(hubToken)) return page("Nieprawidłowy link", "Link zatwierdzenia jest niepoprawny lub wygasł (ważny 1 dzień).", false);
    if (!resend) return page("Brak klucza Resend", "Dodaj resend_api_key w hub_config.", false);

    const { data: targets } = await db.from("hub_partners")
      .select("id, niche, name, domain, url, email, meta")
      .eq("status", "found").not("email", "is", null).limit(15);
    if (!targets?.length) return page("Brak firm w kolejce", "Nie ma nowych firm ze statusem „found” i e-mailem. Uruchom wyszukiwanie ponownie.");

    let sent = 0;
    const lines: string[] = [];
    for (const t of targets) {
      const prop = await proposalFor(cfg, { name: t.name, domain: t.domain, niche: t.niche, title: t.meta?.title ?? null });
      const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.7;color:#111;max-width:600px;margin:0 auto">
${esc(prop.text).replace(/\n/g, "<br>")}
<hr style="border:none;border-top:1px solid #eee;margin:22px 0">
<p style="font-size:11px;color:#999">GrouAI Stream · grouaistream.com · Wiadomość wysłana jednorazowo w sprawie współpracy B2B na publiczny adres firmowy. Nie chcesz kontaktu? Odpowiedz „STOP”, a usuniemy Was z bazy.</p>
</div>`;
      const mailId = await sendMail(resend, from, [t.email], prop.subject, html, admin);
      if (mailId) {
        sent++;
        await db.from("hub_partners").update({ status: "contacted", meta: { ...(t.meta ?? {}), contacted_at: new Date().toISOString(), mail_id: mailId, subject: prop.subject } }).eq("id", t.id);
        lines.push(`✅ ${esc(t.name ?? t.domain)} &lt;${esc(t.email)}&gt;`);
      } else {
        lines.push(`❌ ${esc(t.name ?? t.domain)} — błąd wysyłki`);
      }
    }
    await db.from("hub_log").insert({
      source: "aurora-outreach", level: "info",
      message: `Wysłano propozycje współpracy: ${sent}/${targets.length}`,
    });
    return page(`Wysłano ${sent}/${targets.length} propozycji 🤝`, `<p>Odpowiedzi firm przyjdą na <strong>${esc(admin)}</strong>.</p><p style="margin-top:10px">${lines.join("<br>")}</p>`);
  }

  return json({ error: "not_found", usage: "POST ?phase=find (x-hub-token) | GET ?approve=1&k=<key>" }, 404);
});
