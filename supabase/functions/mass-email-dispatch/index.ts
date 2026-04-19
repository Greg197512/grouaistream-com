import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  emailType: "invitation" | "challenge" | "newsletter" | "weekly_digest" | "easter";
  customMessage?: string;
  webhookOverride?: string;
  audience?: "all_users" | "blog_subscribers";
}

const TYPE_LABELS: Record<string, string> = {
  invitation: "Zaproszenie do GrouAI Stream",
  challenge: "Nowe wyzwanie muzyczne",
  newsletter: "Newsletter GrouAI Stream",
  weekly_digest: "Twoje muzyczne podsumowanie tygodnia",
  easter: "Wesołych Świąt od GrouAI Stream",
};

const IMAGE_PROMPTS: Record<string, string> = {
  invitation: "Cinematic dark moody scene, neon orange light beams, abstract sound waves, premium music platform vibe, ultra detailed, 16:9",
  challenge: "Glowing trophy on dark stage with orange neon spotlights, energetic music challenge atmosphere, cinematic, 16:9",
  newsletter: "Dark editorial magazine cover style, headphones glowing orange, abstract aurora particles, premium 16:9",
  weekly_digest: "Cozy dark room with vinyl records and warm orange ambient light, week recap mood, cinematic 16:9",
  easter: "Elegant easter eggs decorated with neon orange music notes, dark luxurious background, 16:9",
};

async function generateHeroImage(emailType: string, apiKey: string): Promise<string | null> {
  try {
    const prompt = IMAGE_PROMPTS[emailType] || IMAGE_PROMPTS.newsletter;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
    const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return url || null;
  } catch (e) {
    console.error("Image gen exception:", e);
    return null;
  }
}

async function generateEmailCopy(emailType: string, customMessage: string | undefined, apiKey: string) {
  const systemPrompt = `Jesteś copywriterem premium platformy GrouAI Stream — muzyka która słucha Ciebie. Pisz po polsku, ciepło, inteligentnie, max 100 słów. Ton: poetycki ale konkretny.`;
  const userPrompt = `Wygeneruj treść e-maila typu "${emailType}".${customMessage ? ` Kontekst: ${customMessage}` : ""}
Zwróć JSON: { "subject": "...", "headline": "...", "body": "treść 2-3 akapity zwykły tekst", "cta": "tekst przycisku", "ctaUrl": "https://grouaistream.com" }`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`AI copy failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

function buildHtml(copy: any, heroUrl: string | null): string {
  const hero = heroUrl
    ? `<img src="${heroUrl}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px 12px 0 0;" />`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:#0a0a0a;font-family:'Inter',Arial,sans-serif;color:#1a1a1a;}
.wrap{max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;}
.headline{font-family:'Playfair Display',Georgia,serif;font-size:34px;line-height:1.1;color:#0a0a0a;font-weight:900;margin:0 0 16px;}
.body{font-size:16px;line-height:1.7;color:#333;margin:0 0 24px;}
.cta{display:inline-block;background:linear-gradient(135deg,#e8450a,#f59e0b);color:#fff !important;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:600;font-size:15px;letter-spacing:0.3px;}
.footer{padding:24px 32px;background:#0a0a0a;color:#888;font-size:12px;text-align:center;}
.footer a{color:#e8450a;text-decoration:none;}
</style></head>
<body>
<div style="padding:24px 12px;">
<div class="wrap">
${hero}
<div style="padding:36px 32px;">
<h1 class="headline">${copy.headline || copy.subject}</h1>
<div class="body">${(copy.body || "").split("\n").filter((p: string) => p.trim()).map((p: string) => `<p style="margin:0 0 14px;">${p}</p>`).join("")}</div>
<a href="${copy.ctaUrl || "https://grouaistream.com"}" class="cta">${copy.cta || "Otwórz GrouAI Stream"}</a>
</div>
<div class="footer">
GrouAI Stream — muzyka, która słucha Ciebie<br/>
<a href="https://grouaistream.com">grouaistream.com</a>
</div>
</div></div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const { emailType, customMessage, webhookOverride, audience = "all_users" }: Payload = await req.json();

    // Get webhook
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

    // Generate copy + image in parallel
    const [copy, heroUrl] = await Promise.all([
      generateEmailCopy(emailType, customMessage, LOVABLE_API_KEY),
      generateHeroImage(emailType, LOVABLE_API_KEY),
    ]);

    const html = buildHtml(copy, heroUrl);

    // Get recipients
    let recipients: { email: string; name?: string }[] = [];
    if (audience === "blog_subscribers") {
      const { data } = await supaAdmin.from("blog_newsletter_subscribers")
        .select("email").eq("confirmed", true).is("unsubscribed_at", null);
      recipients = (data || []).map((r) => ({ email: r.email }));
    } else {
      const { data } = await supaAdmin.rpc("get_all_users_for_admin");
      recipients = (data || []).filter((u: any) => u.email).map((u: any) => ({ email: u.email, name: u.display_name }));
    }

    // Forward to n8n
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "grouaistream-admin",
        emailType,
        subject: copy.subject || TYPE_LABELS[emailType],
        html,
        heroImageUrl: heroUrl,
        copy,
        recipients,
        recipientCount: recipients.length,
        triggeredAt: new Date().toISOString(),
      }),
    });

    const n8nText = await n8nRes.text().catch(() => "");

    return new Response(JSON.stringify({
      success: n8nRes.ok,
      recipientCount: recipients.length,
      heroImageUrl: heroUrl,
      subject: copy.subject,
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
