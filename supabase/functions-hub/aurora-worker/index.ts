// GROUAI HUB — aurora-worker
// Zastępuje "pracowników n8n". Odbiera zlecenia Aurory (webhook_url w aurora_n8n_workflows
// na projekcie LIVE wskazuje na tę funkcję), wykonuje pracę przez OpenRouter
// i raportuje wynik do aurora-n8n-callback na projekcie LIVE.
//
// Obsługiwane kształty wejścia:
//  A) z aurora-n8n-trigger:    { run_id, workflow_id, order_id, niche_id, callback_url, payload }
//  B) z aurora-assistant-chat: { order_id, service_type, brief, client, budget_eur, deadline, payload }
//
// Auth: ?t=<hub_token> lub nagłówek x-hub-token (wartość w tabeli hub_config).
// Deploy: verify_jwt = false.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { markdownToPdf } from "./pdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-token",
};

const SERVICE_LABELS: Record<string, string> = {
  seo_audit: "Audyt SEO", seo_content: "SEO Content", landing_page: "Landing Page",
  social_post: "Social / TikTok / Reels", automation_flow: "Automatyzacja",
  lead_research: "Lead Research", other: "Projekt B2B",
};

const emailOk = (e: unknown): e is string =>
  typeof e === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e.trim());

// Dane do przelewu (stałe konto rozliczeniowe GrouAI / Grzegorz Karon).
const BANK = { name: "Grzegorz Karon", iban: "LT39 3250 0225 7672 5699", bic: "REVOLT21" };

// Sekcja płatności doklejana do oferty (trafia i do PDF, i do maila).
function paymentSectionMarkdown(orderId: string | null, payUrl?: string | null): string {
  const title = orderId ? `GrouAI ${orderId}` : "GrouAI zlecenie";
  const card = payUrl
    ? `\n\n**2. Karta / online (Paddle)**\n- Zapłać kartą: ${payUrl}`
    : "";
  return `\n\n---\n\n## Płatność\n\nKwota: zgodnie z wyceną w ofercie powyżej. Wybierz wygodną metodę:\n\n**1. Przelew bankowy (SEPA / Revolut)**\n- Odbiorca: ${BANK.name}\n- IBAN: ${BANK.iban}\n- BIC/SWIFT: ${BANK.bic}\n- Tytuł przelewu: ${title}${card}\n\nPo opłaceniu **prześlij potwierdzenie w oknie czatu Aurory** (lub odpowiedz na tego maila) — Aurora od razu zapisze płatność do Twoich dokumentów, ruszamy z realizacją i otwieramy Twój panel klienta.`;
}

// Wspólny dopisek do promptu: wymusza bardzo szczegółowy zakres + konkretną cenę.
const DETAIL_SUFFIX =
  "\n\nWAŻNE: Materiał ma być BARDZO SZCZEGÓŁOWY i gotowy do realizacji. Na końcu ZAWSZE dodaj sekcję \"## Zakres i wycena\" zawierającą: (a) dokładny, punktowany zakres prac — co konkretnie wykonamy, krok po kroku; (b) co dokładnie klient otrzyma (konkretne rezultaty/pliki); (c) termin realizacji; (d) KONKRETNĄ cenę w EUR (jednorazowo) dobraną do zakresu. Pisz po polsku, rzeczowo, bez lania wody. NIE dodawaj sekcji o płatności ani danych do przelewu — dopisze je system.";

// Uint8Array → base64 (porcjami, żeby nie przepełnić stosu przy dużych plikach).
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

// Wysyła klientowi gotowy materiał: KRÓTKI e-mail + pełna oferta w załączonym PDF
// (treść nie jest dublowana w body — cały zakres/wycena/płatność są w PDF). Kopia dla zespołu w BCC.
async function emailDeliverable(cfg: Record<string, string>, args: {
  to: string; clientName?: string | null; serviceLabel: string;
  orderId: string | null; pdf: Uint8Array;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = cfg["resend_api_key"];
  if (!key) return { ok: false, error: "resend_api_key_missing" };
  const from = cfg["lead_from_email"] || "GrouAI Stream <noreply@grouarock.com>";
  const teamEmail = cfg["lead_notify_email"] || "grouarock@gmail.com";
  const greeting = args.clientName ? `Cześć ${esc(args.clientName)}!` : "Cześć!";
  const fileBase = `GrouAI_${(args.serviceLabel || "materiał").replace(/[^\p{L}\p{N}]+/gu, "_")}${args.orderId ? "_" + args.orderId : ""}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;margin:0 auto">
<p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#FF6B00;margin:0 0 4px">GrouAI Stream · ${esc(args.serviceLabel)}</p>
<h1 style="font-size:21px;margin:0 0 12px">${greeting}</h1>
<p style="margin:0 0 12px">W załączniku znajdziesz <strong>pełną ofertę w PDF</strong>${args.orderId ? ` (zlecenie <strong>${esc(args.orderId)}</strong>)` : ""} — szczegółowy zakres prac, wycenę i dane do płatności.</p>
<p style="margin:0 0 12px">Po opłaceniu prześlij potwierdzenie w czacie Aurory — ruszamy z realizacją i otwieramy Twój panel klienta.</p>
<p style="margin:0 0 6px">Masz pytania? Po prostu odpowiedz na tego maila.</p>
<hr style="border:none;border-top:1px solid #eee;margin:20px 0">
<p style="font-size:12px;color:#888">GrouAI Stream · <a href="https://grouaistream.com" style="color:#FF6B00">grouaistream.com</a> · kontakt: ${esc(teamEmail)}</p>
</div>`;
  try {
    const payload: Record<string, unknown> = {
      from,
      to: [args.to],
      reply_to: teamEmail,
      subject: `Twój materiał od GrouAI Stream: ${args.serviceLabel}${args.orderId ? " — " + args.orderId : ""}`,
      html,
      attachments: [{ filename: `${fileBase}.pdf`, content: bytesToBase64(args.pdf) }],
    };
    if (emailOk(teamEmail) && teamEmail.toLowerCase() !== args.to.toLowerCase()) payload.bcc = [teamEmail];
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: (b?.name || b?.message) ? `${b.name || ""} ${b.message || ""}`.trim() : `resend_${r.status}` };
    return { ok: true, id: b?.id ?? "sent" };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function loadConfig(db: any): Promise<Record<string, string>> {
  const { data } = await db.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of data || []) cfg[row.key] = row.value ?? "";
  return cfg;
}

const SERVICE_PROMPTS: Record<string, string> = {
  seo_audit:
    "Jesteś ekspertem SEO. Na podstawie briefu przygotuj profesjonalny audyt SEO po polsku (markdown): 1) podsumowanie, 2) analiza on-page (tytuły, meta, nagłówki, treść), 3) technika (szybkość, indeksacja, mobile, schema), 4) treści i słowa kluczowe, 5) linkowanie, 6) lista TOP 10 działań wg priorytetu z szacunkiem wpływu.",
  seo_content:
    "Jesteś copywriterem SEO. Napisz gotowy do publikacji artykuł po polsku (markdown) na podstawie briefu: chwytliwy tytuł, meta description (max 155 znaków), lead, śródtytuły H2/H3, 800-1200 słów, naturalne słowa kluczowe, CTA na końcu.",
  landing_page:
    "Jesteś specjalistą CRO/copy. Przygotuj kompletną treść landing page po polsku (markdown): hero (nagłówek + podtytuł + CTA), 3 sekcje korzyści, dowód społeczny, sekcja oferty/cennika, FAQ (5 pytań), stopka CTA. Dodaj krótkie wskazówki układu dla developera.",
  social_post:
    "Jesteś social media managerem. Przygotuj pakiet postów na podstawie briefu: X/Twitter (max 260 znaków), Facebook po polsku, Instagram caption + 5 hashtagów, skrypt TikTok 15s, post LinkedIn. Zwróć w markdown z sekcjami per platforma.",
  automation_flow:
    "Jesteś architektem automatyzacji. Zaprojektuj workflow automatyzacji na podstawie briefu: trigger, kroki (nazwa, cel, narzędzie), zmienne, obsługa błędów, oczekiwany efekt, szacowany czas wdrożenia. Zwróć w markdown z diagramem tekstowym kroków.",
  lead_research:
    "Jesteś analitykiem sprzedaży. Na podstawie briefu przygotuj plan lead-research po polsku: profil idealnego klienta (ICP), 5 segmentów docelowych, legalne źródła pozyskania kontaktów (bez scrapingu maili!), szablon wiadomości opt-in, plan działań na 2 tygodnie.",
  other:
    "Jesteś wszechstronnym konsultantem biznesowym. Wykonaj zadanie z briefu najlepiej jak potrafisz i zwróć konkretny, gotowy do użycia rezultat po polsku w markdown.",
};

async function generateDeliverable(cfg: Record<string, string>, serviceType: string, brief: string, extra: unknown) {
  const key = cfg["openrouter_api_key"];
  if (!key) throw new Error("hub_ai_key_missing");
  // Łańcuch modeli: pierwszy działający wygrywa (odporność na limity darmowych modeli)
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "google/gemini-2.5-flash")
    .split(",").map((m) => m.trim()).filter(Boolean);
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://grouaistream.com",
          "X-Title": "GrouAI Hub Worker",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: (SERVICE_PROMPTS[serviceType] ?? SERVICE_PROMPTS.other) + DETAIL_SUFFIX },
            {
              role: "user",
              content: `BRIEF KLIENTA:\n${brief}\n\nDODATKOWY KONTEKST (JSON):\n${JSON.stringify(extra ?? {}).slice(0, 3000)}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastErr = `openrouter_${res.status} [${model}]: ${t.slice(0, 150)}`;
        continue;
      }
      const out = await res.json();
      if (out.error) {
        lastErr = `openrouter [${model}]: ${JSON.stringify(out.error).slice(0, 150)}`;
        continue;
      }
      const content: string = out.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        lastErr = `openrouter_empty_response [${model}]`;
        continue;
      }
      return { content, model, usage: out.usage ?? null };
    } catch (e) {
      lastErr = `openrouter_fetch [${model}]: ${String(e).slice(0, 120)}`;
    }
  }
  throw new Error(lastErr || "openrouter_all_models_failed");
}

async function postCallback(url: string, body: Record<string, unknown>) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = await loadConfig(db);

  const url = new URL(req.url);
  const token = url.searchParams.get("t") || req.headers.get("x-hub-token") || "";
  if (!cfg["hub_token"] || token !== cfg["hub_token"]) return json({ error: "unauthorized" }, 401);

  if (!cfg["openrouter_api_key"]) {
    // Bez klucza AI nie podejmujemy zadania — LIVE oznaczy run jako failed / zostawi w kolejce.
    await db.from("hub_log").insert({ source: "aurora-worker", level: "warn", message: "Odrzucono zadanie: brak openrouter_api_key w hub_config" });
    return json({ error: "hub_ai_key_missing", hint: "Dodaj klucz OpenRouter do hub_config" }, 503);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const runId: string | null = body.run_id ?? null;
  const orderId: string | null = body.order_id ?? null;
  const workflowId: string = body.workflow_id ?? "";
  const serviceType: string =
    body.service_type || body.payload?.service_type || workflowId.replace(/-/g, "_") || "other";
  const brief: string = body.brief || body.payload?.brief || JSON.stringify(body.payload ?? {}).slice(0, 2000);

  // Callback tylko do znanego hosta LIVE (ochrona przed SSRF przez podstawiony callback_url)
  const liveUrl = cfg["bvstv_url"] || "https://bvstvawnigyczvofzhps.supabase.co";
  let callbackUrl: string | null = typeof body.callback_url === "string" ? body.callback_url : null;
  if (callbackUrl && !callbackUrl.startsWith(liveUrl + "/")) callbackUrl = null;

  const work = async () => {
    const startedAt = Date.now();
    try {
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, {
          run_id: runId, type: "step", step_index: 0, node_name: "grouai-hub",
          status: "success", message: `Hub przyjął zadanie (${serviceType})`,
        });
      }
      const result = await generateDeliverable(cfg, serviceType, brief, body.payload ?? body.client ?? {});
      const output = {
        deliverable_markdown: result.content,
        summary: result.content.slice(0, 400),
        service_type: serviceType,
        order_id: orderId,
        generated_by: "grouai-hub",
        model: result.model,
        duration_ms: Date.now() - startedAt,
      };
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, { run_id: runId, type: "finish", status: "success", output });
      }
      await db.from("hub_log").insert({
        source: "aurora-worker", level: "info",
        message: `Zlecenie wykonane (${serviceType})${orderId ? ` order=${orderId}` : ""}${runId ? ` run=${runId}` : ""}`,
        data: { order_id: orderId, run_id: runId, service_type: serviceType, model: result.model, chars: result.content.length },
      });
      // Zachowaj pełny wynik po stronie huba (kopia bezpieczeństwa / wgląd bez panelu LIVE)
      await db.from("hub_deliverables").insert({
        order_id: orderId, run_id: runId, service_type: serviceType,
        brief: brief.slice(0, 4000), deliverable: result.content, model: result.model,
      });

      // ── Dostarczenie klientowi: PDF w mailu (to, co Aurora obiecuje w czacie) ──
      const payloadObj = (body.payload ?? {}) as Record<string, any>;
      const clientObj = (body.client ?? {}) as Record<string, any>;
      const clientEmail = [payloadObj.email, clientObj.email, body.client_email]
        .find((e) => emailOk(e)) as string | undefined;
      const clientName = payloadObj.full_name || clientObj.name || clientObj.full_name || null;
      const serviceLabel = SERVICE_LABELS[serviceType] ?? "Projekt B2B";

      if (clientEmail) {
        try {
          const payUrl = cfg["pay_url_base"] && orderId
            ? `${cfg["pay_url_base"]}?order=${encodeURIComponent(orderId)}`
            : null;
          const fullMarkdown = result.content + paymentSectionMarkdown(orderId, payUrl);
          const pdf = await markdownToPdf({
            title: `${serviceLabel} — GrouAI Stream`,
            subtitle: orderId ? `Oferta i zakres · zlecenie ${orderId}` : undefined,
            markdown: fullMarkdown,
          });
          const sent = await emailDeliverable(cfg, {
            to: clientEmail, clientName, serviceLabel, orderId, pdf,
          });
          await db.from("hub_log").insert({
            source: "aurora-worker", level: sent.ok ? "info" : "error",
            message: sent.ok
              ? `PDF wysłany do klienta (${clientEmail})${orderId ? ` order=${orderId}` : ""} [${sent.id}]`
              : `NIE wysłano PDF do ${clientEmail}: ${sent.error}`,
            data: { order_id: orderId, run_id: runId, pdf_bytes: pdf.length },
          });
        } catch (pe) {
          await db.from("hub_log").insert({
            source: "aurora-worker", level: "error",
            message: `Błąd generowania/wysyłki PDF (${serviceType}): ${String(pe).slice(0, 180)}`,
            data: { order_id: orderId, run_id: runId, client_email: clientEmail },
          });
        }
      } else {
        await db.from("hub_log").insert({
          source: "aurora-worker", level: "warn",
          message: `Brak e-maila klienta — PDF wygenerowany, ale nie ma gdzie wysłać${orderId ? ` order=${orderId}` : ""}`,
          data: { order_id: orderId, run_id: runId },
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (runId && callbackUrl) {
        await postCallback(callbackUrl, { run_id: runId, type: "finish", status: "failed", error: `grouai-hub: ${msg}` });
      }
      await db.from("hub_log").insert({
        source: "aurora-worker", level: "error",
        message: `Błąd wykonania (${serviceType}): ${msg}`,
        data: { order_id: orderId, run_id: runId },
      });
    }
  };

  // Odpowiadamy od razu (trigger na LIVE czeka synchronicznie), praca w tle.
  try {
    // @ts-ignore — dostępne w Supabase Edge Runtime
    EdgeRuntime.waitUntil(work());
  } catch {
    await work();
  }

  return json({ ok: true, accepted: true, run_id: runId, order_id: orderId, worker: "grouai-hub" }, 200);
});
