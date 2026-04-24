import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EmailType =
  | "invitation"
  | "challenge"
  | "newsletter"
  | "weekly_digest"
  | "easter"
  | "feature_announcement"
  | "tip_of_the_week"
  | "blog_post"
  | "milestone"
  | "comeback"
  | "thank_you"
  | "ai_studio_promo"
  | "live_radio_promo"
  | "party_mode_promo"
  | "custom";

type Lang = "pl" | "en" | "nl" | "uk";
type LangSetting = Lang | "auto";

interface Payload {
  emailType: EmailType;
  customMessage?: string;
  customSubject?: string;
  language?: LangSetting;
  webhookOverride?: string;
  audience?: "all_users" | "blog_subscribers";
  mode?: "n8n" | "direct";
}

// === Auto-detekcja języka po e-mailu ===
// Kolejność: TLD domeny -> słowa-klucze w domenie -> fallback EN
function detectLanguageFromEmail(email: string, displayName?: string): Lang {
  const lower = (email || "").toLowerCase().trim();
  const domain = lower.split("@")[1] || "";
  const tld = domain.split(".").pop() || "";

  // Polskie domeny i providerzy
  if (tld === "pl" || /\b(wp|onet|interia|o2|gazeta|poczta)\b/.test(domain)) return "pl";

  // Holenderskie / belgijskie (NL)
  if (tld === "nl" || tld === "be" || /\b(kpn|ziggo|telfort|xs4all|home|hetnet|planet|chello)\b/.test(domain)) return "nl";

  // Ukraińskie
  if (tld === "ua" || /\b(ukr|meta|i\.ua)\b/.test(domain)) return "uk";

  // Anglojęzyczne TLD
  if (["com", "co", "uk", "us", "ie", "ca", "au", "nz", "io", "net", "org", "edu", "gov"].includes(tld)) {
    // Spróbuj zgadnąć po nazwie wyświetlanej (czasem zawiera polskie znaki)
    const name = (displayName || "").toLowerCase();
    if (/[ąćęłńóśźż]/.test(name)) return "pl";
    if (/[іїєґ]/.test(name)) return "uk";
    return "en";
  }

  // Inne europejskie / nieznane → EN (uniwersalne)
  return "en";
}

// === I18n: tytuły zapasowe i nazwy etykiet ===
const TYPE_LABELS: Record<Lang, Partial<Record<EmailType, string>>> = {
  pl: {
    invitation: "Zaproszenie do GrouAI Stream",
    challenge: "Nowe wyzwanie muzyczne",
    newsletter: "Newsletter GrouAI Stream",
    weekly_digest: "Twoje muzyczne podsumowanie tygodnia",
    easter: "Wesołych Świąt od GrouAI Stream",
    feature_announcement: "Nowość w GrouAI Stream",
    tip_of_the_week: "Trik tygodnia od GrouAI",
    blog_post: "Świeży wpis na blogu GrouAI",
    milestone: "Świętujemy razem 🎉",
    comeback: "Tęsknimy za Tobą",
    thank_you: "Dziękujemy, że jesteś z nami",
    ai_studio_promo: "AI Studio czeka na Twój utwór",
    live_radio_promo: "Wskocz do radia na żywo",
    party_mode_promo: "Twoja impreza zasługuje na DJ-a AI",
    custom: "Wiadomość od GrouAI Stream",
  },
  en: {
    invitation: "An invitation to GrouAI Stream",
    challenge: "New music challenge",
    newsletter: "GrouAI Stream newsletter",
    weekly_digest: "Your weekly music recap",
    easter: "Happy Easter from GrouAI Stream",
    feature_announcement: "Something new on GrouAI Stream",
    tip_of_the_week: "Tip of the week from GrouAI",
    blog_post: "Fresh from the GrouAI blog",
    milestone: "We're celebrating together 🎉",
    comeback: "We miss you",
    thank_you: "Thank you for being here",
    ai_studio_promo: "AI Studio is waiting for your track",
    live_radio_promo: "Jump into live radio",
    party_mode_promo: "Your party deserves an AI DJ",
    custom: "A message from GrouAI Stream",
  },
  nl: {
    invitation: "Een uitnodiging voor GrouAI Stream",
    challenge: "Nieuwe muziekuitdaging",
    newsletter: "GrouAI Stream nieuwsbrief",
    weekly_digest: "Jouw muzikale weekoverzicht",
    easter: "Vrolijk Pasen vanuit GrouAI Stream",
    feature_announcement: "Iets nieuws op GrouAI Stream",
    tip_of_the_week: "Tip van de week van GrouAI",
    blog_post: "Vers van de GrouAI-blog",
    milestone: "Wij vieren het samen 🎉",
    comeback: "Wij missen je",
    thank_you: "Bedankt dat je er bent",
    ai_studio_promo: "AI Studio staat klaar voor jouw nummer",
    live_radio_promo: "Spring in de live radio",
    party_mode_promo: "Jouw feest verdient een AI-DJ",
    custom: "Een bericht van GrouAI Stream",
  },
  uk: {
    invitation: "Запрошення до GrouAI Stream",
    challenge: "Новий музичний виклик",
    newsletter: "Розсилка GrouAI Stream",
    weekly_digest: "Твій музичний підсумок тижня",
    easter: "Веселого Великодня від GrouAI Stream",
    feature_announcement: "Щось нове на GrouAI Stream",
    tip_of_the_week: "Порада тижня від GrouAI",
    blog_post: "Свіже на блозі GrouAI",
    milestone: "Святкуємо разом 🎉",
    comeback: "Ми сумуємо за тобою",
    thank_you: "Дякуємо, що ти з нами",
    ai_studio_promo: "AI Studio чекає на твій трек",
    live_radio_promo: "Стрибай у радіо наживо",
    party_mode_promo: "Твоя вечірка заслуговує на AI DJ-я",
    custom: "Повідомлення від GrouAI Stream",
  },
};

// Wszystkie maile używają jednego elastycznego szablonu
const TEMPLATE_NAME = "admin-notification";

// Premium prompt grafiki — zawsze coś świeżego, zawsze cinematic
function buildImagePrompt(emailType: EmailType, copyHeadline?: string): string {
  const baseStyle = "ultra-cinematic editorial style, deep black background with soft aurora borealis, vibrant orange neon (#e8450a) and warm amber (#f59e0b) accents, glowing bass particles, premium music platform aesthetic, dramatic light rays, depth of field, 16:9, no text, no logos, no watermarks";
  const themes: Record<EmailType, string> = {
    invitation: "elegant glowing music portal opening into a dark velvet space with floating sound waves",
    challenge: "iconic glowing trophy on a dark stage surrounded by orange spotlights and bass particles",
    newsletter: "dark editorial magazine cover, glowing headphones suspended in aurora light",
    weekly_digest: "cozy dark studio at night, vinyl records glowing under warm amber lamp, week timeline",
    easter: "elegant decorated easter eggs with neon orange music notes on luxurious black silk",
    feature_announcement: "futuristic neon music interface floating in dark space, glowing buttons revealing new feature",
    tip_of_the_week: "close-up of glowing lightbulb made of music notes, dark moody background",
    blog_post: "elegant open book transforming into musical waves, dark editorial style",
    milestone: "fireworks of orange neon light over dark city skyline, celebratory cinematic mood",
    comeback: "lonely glowing microphone in dim spotlight, warm nostalgic atmosphere",
    thank_you: "warm orange heart made of glowing sound waves on deep black background",
    ai_studio_promo: "futuristic AI music workstation with floating waveforms and neon controls",
    live_radio_promo: "glowing on-air sign in dark radio studio, vintage microphone with neon halo",
    party_mode_promo: "crowded silhouettes dancing under orange laser lights, energetic club atmosphere",
    custom: "abstract orange aurora flowing through dark cosmic space with bass particles",
  };
  const theme = themes[emailType] || themes.custom;
  const headlineHint = copyHeadline ? ` Inspired by: "${copyHeadline}".` : "";
  return `${theme}.${headlineHint} ${baseStyle}`;
}

async function generateHeroImage(emailType: EmailType, apiKey: string, copyHeadline?: string): Promise<string | null> {
  try {
    const prompt = buildImagePrompt(emailType, copyHeadline);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("Image gen failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (e) {
    console.error("Image gen exception:", e);
    return null;
  }
}

// System prompts per language — w każdym pisz natywnie
const SYSTEM_PROMPTS: Record<Lang, string> = {
  pl: `Jesteś copywriterem premium platformy GrouAI Stream — "muzyka, która słucha Ciebie".
Pisz po polsku, ciepło, poetycko ale konkretnie. Maks 110 słów w body.
Ton: emocjonalny, premium, jak dobry magazyn. Bez sztampy, bez "Cześć!", bez emotek na siłę.
Nigdy nie obiecuj cudów. Subject < 60 znaków, headline mocne i intrygujące.`,
  en: `You are a premium copywriter for GrouAI Stream — "music that listens to you".
Write in English, warm, poetic but concrete. Max 110 words in body.
Tone: emotional, premium, like a great magazine. No clichés, no "Hey!", no forced emojis.
Never overpromise. Subject < 60 chars, headline bold and intriguing.`,
  nl: `Je bent een premium copywriter voor GrouAI Stream — "muziek die naar jou luistert".
Schrijf in onberispelijk, warm en respectvol Nederlands. Gebruik beleefdheidsvormen waar gepast.
Let zeer goed op grammatica, spelling en interpunctie — schrijf alsof het een artikel in De Correspondent of NRC zou zijn.
Maximaal 110 woorden in de body. Toon: emotioneel, premium, als een prachtig tijdschrift.
Geen clichés, geen "Hoi!", geen geforceerde emoji's. Beloof nooit te veel.
Onderwerp < 60 tekens, krachtige en intrigerende kop.`,
  uk: `Ти преміум-копірайтер платформи GrouAI Stream — "музика, що слухає тебе".
Пиши українською, тепло, поетично але конкретно. Максимум 110 слів у тілі.
Тон: емоційний, преміум, як гарний журнал. Без штампів, без "Привіт!", без зайвих емоджі.
Ніколи не обіцяй надто багато. Тема < 60 знаків, заголовок сильний та інтригуючий.`,
};

const JSON_HINTS: Record<Lang, string> = {
  pl: 'Zwróć JSON: { "subject": "...", "headline": "...", "body": "treść 2-3 akapity zwykły tekst", "cta": "tekst przycisku", "ctaUrl": "https://grouaistream.com" }',
  en: 'Return JSON: { "subject": "...", "headline": "...", "body": "2-3 plain text paragraphs", "cta": "button text", "ctaUrl": "https://grouaistream.com" }',
  nl: 'Geef JSON terug: { "subject": "...", "headline": "...", "body": "2-3 alinea\'s platte tekst", "cta": "tekst van de knop", "ctaUrl": "https://grouaistream.com" }',
  uk: 'Поверни JSON: { "subject": "...", "headline": "...", "body": "2-3 абзаци звичайного тексту", "cta": "текст кнопки", "ctaUrl": "https://grouaistream.com" }',
};

const TYPE_DESCRIPTIONS: Record<EmailType, string> = {
  invitation: "warm invitation to join GrouAI Stream — emphasize the personal, empathic music experience",
  challenge: "announce a new music challenge — exciting, motivating, mention a small reward or community vibe",
  newsletter: "monthly newsletter update with what's new on the platform",
  weekly_digest: "personal weekly recap of mood, top tracks, listening time",
  easter: "warm seasonal Easter greetings",
  feature_announcement: "announce a brand new feature — explain the benefit in one sentence",
  tip_of_the_week: "share one practical tip about using GrouAI Stream — voice commands, mood detection, AI Studio, etc.",
  blog_post: "tease a new blog post — intriguing hook, invite to read",
  milestone: "celebrate a platform milestone (users, tracks, feature anniversary)",
  comeback: "we miss you message to inactive users — warm, no guilt, single soft CTA",
  thank_you: "heartfelt thank you to the community",
  ai_studio_promo: "promote the AI Studio — create your own 30-second tracks in 15 genres",
  live_radio_promo: "promote live radio — thousands of hearts hearing the same drop at the same moment",
  party_mode_promo: "promote party mode — QR code, guest voting, crowd emotion detection",
  custom: "free-form message based on the admin's custom instructions",
};

async function generateEmailCopy(
  emailType: EmailType,
  customMessage: string | undefined,
  customSubject: string | undefined,
  language: Lang,
  apiKey: string,
) {
  const sys = SYSTEM_PROMPTS[language];
  const hint = JSON_HINTS[language];
  const purpose = TYPE_DESCRIPTIONS[emailType];

  const userPrompt = `Generate an email content. Purpose: ${purpose}.
${customSubject ? `Suggested subject (use as inspiration but improve if needed): "${customSubject}".` : ""}
${customMessage ? `Admin context to weave in: ${customMessage}` : ""}

${hint}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI copy failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function buildHtml(copy: any, heroUrl: string | null, language: Lang): string {
  const hero = heroUrl
    ? `<img src="${heroUrl}" alt="" style="display:block;width:100%;max-width:600px;height:auto;" />`
    : `<div style="height:8px;background:linear-gradient(90deg,#e8450a,#f59e0b,#e8450a);"></div>`;
  const footerText: Record<Lang, string> = {
    pl: "GrouAI Stream — muzyka, która słucha Ciebie",
    en: "GrouAI Stream — music that listens to you",
    nl: "GrouAI Stream — muziek die naar jou luistert",
    uk: "GrouAI Stream — музика, що слухає тебе",
  };
  const bodyParas = (copy.body || "")
    .split("\n")
    .filter((p: string) => p.trim())
    .map((p: string) => `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.75;color:#2d2d2d;font-family:'Inter',Arial,sans-serif;">${p}</p>`)
    .join("");
  return `<!DOCTYPE html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;color:#1a1a1a;">
<div style="padding:24px 12px;background:#0a0a0a;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(232,69,10,0.15);">
<div style="padding:16px 32px;background:#0a0a0a;color:#ffffff;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:18px;letter-spacing:0.4px;">Grou<span style="color:#e8450a;">AI</span> Stream</div>
<div style="background:#0a0a0a;">${hero}</div>
<div style="padding:40px 32px 32px;background:#ffffff;">
<h1 style="font-family:'Space Grotesk',Georgia,serif;font-size:32px;line-height:1.15;color:#0a0a0a;font-weight:700;margin:0 0 18px 0;letter-spacing:-0.4px;">${copy.headline || copy.subject || ""}</h1>
<div style="margin:0 0 28px 0;color:#2d2d2d;">${bodyParas}</div>
<a href="${copy.ctaUrl || "https://grouaistream.com"}" style="display:inline-block;background:#e8450a;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:999px;font-weight:600;font-size:15px;letter-spacing:0.4px;font-family:'Inter',Arial,sans-serif;">${copy.cta || "GrouAI Stream"}</a>
<div style="height:1px;background:#f1d4c4;margin:32px 0 0 0;"></div>
</div>
<div style="padding:24px 32px;background:#0a0a0a;color:#888888;font-size:12px;text-align:center;line-height:1.6;font-family:'Inter',Arial,sans-serif;">
${footerText[language]}<br/>
<a href="https://grouaistream.com" style="color:#e8450a;text-decoration:none;font-weight:500;">grouaistream.com</a><br/>
<span style="display:inline-block;margin-top:6px;padding:4px 10px;border:1px solid rgba(232,69,10,0.3);border-radius:999px;color:#e8450a;font-size:10px;letter-spacing:1px;text-transform:uppercase;">AI · LIVE · STUDIO</span>
</div>
</div></div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supaUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdminData } = await supaAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdminData) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const {
      emailType,
      customMessage,
      customSubject,
      language = "auto",
      webhookOverride,
      audience = "all_users",
      mode = "direct",
    }: Payload = await req.json();

    // === Pobierz odbiorców ===
    let recipients: { email: string; name?: string }[] = [];
    if (audience === "blog_subscribers") {
      const { data } = await supaAdmin.from("blog_newsletter_subscribers")
        .select("email").eq("confirmed", true).is("unsubscribed_at", null);
      recipients = (data || []).map((r) => ({ email: r.email }));
    } else {
      const { data } = await supaAdmin.rpc("get_all_users_for_admin");
      recipients = (data || []).filter((u: any) => u.email).map((u: any) => ({ email: u.email, name: u.display_name }));
    }

    const { data: suppressed } = await supaAdmin.from("suppressed_emails").select("email");
    const suppressedSet = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));
    recipients = recipients.filter((r) => !suppressedSet.has(r.email.toLowerCase()));

    // === Przypisz język do każdego odbiorcy ===
    const autoMode = (language as LangSetting) === "auto";
    const requestedLang: Lang = (["pl", "en", "nl", "uk"].includes(language as string) ? (language as Lang) : "pl");
    const recipientsWithLang = recipients.map((r) => ({
      ...r,
      lang: autoMode ? detectLanguageFromEmail(r.email, r.name) : requestedLang,
    }));

    // === Generuj copy per język (tylko te, które są potrzebne) ===
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const usedLangs = Array.from(new Set(recipientsWithLang.map((r) => r.lang))) as Lang[];
    const copyByLang: Record<string, any> = {};
    let heroUrl: string | null = null;

    if (LOVABLE_API_KEY) {
      // Hero image — jedna grafika dla całej kampanii (oszczędność)
      try {
        heroUrl = await generateHeroImage(emailType, LOVABLE_API_KEY, customSubject || customMessage);
      } catch (e) {
        console.error("Image gen failed:", e);
      }

      // Copy w każdym potrzebnym języku
      for (const l of usedLangs) {
        try {
          copyByLang[l] = await generateEmailCopy(emailType, customMessage, customSubject, l, LOVABLE_API_KEY);
        } catch (e) {
          console.error(`AI copy failed for ${l}, fallback used:`, e);
        }
      }
    }

    // Fallback dla brakujących języków
    for (const l of usedLangs) {
      if (!copyByLang[l]) {
        const fb = customSubject || TYPE_LABELS[l][emailType] || TYPE_LABELS.en[emailType] || "GrouAI Stream";
        copyByLang[l] = {
          subject: fb,
          headline: fb,
          body: customMessage || "GrouAI Stream",
          cta: "Open GrouAI Stream",
          ctaUrl: "https://grouaistream.com",
        };
      }
    }

    // Pre-render HTML per język
    const htmlByLang: Record<string, string> = {};
    for (const l of usedLangs) {
      htmlByLang[l] = buildHtml(copyByLang[l], heroUrl, l);
    }

    // Statystyki języków (do raportu)
    const langStats: Record<string, number> = {};
    for (const r of recipientsWithLang) langStats[r.lang] = (langStats[r.lang] || 0) + 1;

    // Reprezentatywne copy do odpowiedzi (preferuj PL, potem EN)
    const primaryLang: Lang = (usedLangs.includes("pl") ? "pl" : usedLangs[0] || "en") as Lang;
    const sharedCopy = copyByLang[primaryLang];

    // === DIRECT mode ===
    if (mode === "direct") {
      const stamp = Date.now();
      let queued = 0;
      let errors = 0;

      for (const r of recipientsWithLang) {
        try {
          const lang = r.lang;
          const copy = copyByLang[lang];
          const fullHtml = htmlByLang[lang];
          const idempotencyKey = `mass-${emailType}-${lang}-${stamp}-${r.email}`;
          const templateData: any = {
            title: copy.subject || TYPE_LABELS[lang][emailType] || "GrouAI Stream",
            message: copy.body,
            recipientName: r.name,
            emailType: TYPE_LABELS[lang][emailType] || emailType,
            heroImageUrl: heroUrl,
            language: lang,
            cta: copy.cta,
            ctaUrl: copy.ctaUrl,
            headline: copy.headline,
            fullHtml,
          };

          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({
              templateName: TEMPLATE_NAME,
              recipientEmail: r.email,
              idempotencyKey,
              templateData,
            }),
          });
          if (res.ok) queued++;
          else {
            errors++;
            console.error(`Failed for ${r.email}:`, res.status, await res.text().catch(() => ""));
          }
        } catch (e) {
          errors++;
          console.error(`Exception for ${r.email}:`, e);
        }
        await new Promise((rs) => setTimeout(rs, 300));
      }

      return new Response(JSON.stringify({
        success: true,
        mode: "direct",
        language: autoMode ? "auto" : requestedLang,
        languageBreakdown: langStats,
        recipientCount: recipientsWithLang.length,
        queued,
        errors,
        templateName: TEMPLATE_NAME,
        subject: sharedCopy?.subject,
        heroImageUrl: heroUrl,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pozostały kod (n8n) używa pierwszego języka jako reprezentatywnego
    const lang: Lang = primaryLang;
    const fullHtml = htmlByLang[lang];
    const fallbackSubject = sharedCopy.subject;

    // === N8N mode ===
    let webhookUrl = webhookOverride;
    if (!webhookUrl) {
      const { data: settings } = await supaAdmin.from("admin_settings").select("n8n_webhook_url").eq("id", 1).maybeSingle();
      webhookUrl = settings?.n8n_webhook_url || Deno.env.get("N8N_WEBHOOK_URL") || undefined;
    }
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "Brak URL webhooka n8n. Dodaj go w panelu lub jako sekret N8N_WEBHOOK_URL." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "grouaistream-admin",
        emailType,
        language: lang,
        subject: sharedCopy.subject || fallbackSubject,
        html: fullHtml,
        heroImageUrl: heroUrl,
        copy: sharedCopy,
        recipients,
        recipientCount: recipients.length,
        triggeredAt: new Date().toISOString(),
      }),
    });
    const n8nText = await n8nRes.text().catch(() => "");

    return new Response(JSON.stringify({
      success: n8nRes.ok,
      mode: "n8n",
      language: lang,
      recipientCount: recipients.length,
      heroImageUrl: heroUrl,
      subject: sharedCopy.subject,
      n8nStatus: n8nRes.status,
      n8nResponse: n8nText.slice(0, 500),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("mass-email-dispatch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
