// TYMCZASOWA funkcja migracji (do usunięcia po przeniesieniu): przekazuje sekrety funkcji
// serwer–serwer do sejfu (Vault) nowego projektu Supabase. Docelowy adres jest stały, a zapis
// wymaga jednorazowego tokenu podanego w wywołaniu — bez niego nowy projekt odrzuca dane.
// Odpowiedź zawiera wyłącznie NAZWY przekazanych sekretów, nigdy wartości.
const TARGET = "https://sbmfliylgpqyteezrrtn.supabase.co/rest/v1/rpc/_mig_put";
const TARGET_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibWZsaXlsZ3BxeXRlZXpycnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2Nzk4MzcsImV4cCI6MjEwODI1NTgzN30.ZqHbHa5ONd0oDyXg1-_OBzEOtXm3JGEIgNltWmgN1bo";

const NAMES = [
  "ACE_REPLICATE_MODEL", "ANTHROPIC_API_KEY", "APIFY_TOKEN", "AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION",
  "CRON_SECRET", "DEEPSEEK_API_KEY", "DISCORD_INVOICE_WEBHOOK_URL", "ELEVENLABS_API_KEY", "FIRECRAWL_API_KEY",
  "GEMINI_API_KEY", "GROK_API_KEY", "GROQ_API_KEY", "INVOICE_SELLER_JSON", "LOVABLE_API_KEY", "MISTRAL_API_KEY",
  "N8N_INVOICE_WEBHOOK_URL", "N8N_ROUTER_WEBHOOK_URL", "N8N_WEBHOOK_URL", "NEWSLETTER_AUTOMATION_TOKEN",
  "OPENAI_API_KEY", "OPENROUTER_API_KEY", "PADDLE_LIVE_API_KEY", "PADDLE_SANDBOX_API_KEY",
  "PAYMENTS_LIVE_WEBHOOK_SECRET", "PAYMENTS_SANDBOX_WEBHOOK_SECRET", "R2_PUBLIC_BASE", "REPLICATE_API_TOKEN",
  "RESEND_API_KEY", "S3_ACCESS_KEY_ID", "S3_BUCKET_NAME", "S3_ENDPOINT", "S3_REGION", "S3_SECRET_ACCESS_KEY",
  "SUNO_API_KEY", "YOUTUBE_API_KEY",
];

Deno.serve(async (req) => {
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const { token } = await req.json().catch(() => ({} as { token?: string }));
  if (!token || typeof token !== "string") return json({ error: "token required" }, 400);

  const values: Record<string, string> = {};
  for (const n of NAMES) {
    const v = Deno.env.get(n);
    if (v) values[n] = v;
  }
  const r = await fetch(TARGET, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: TARGET_ANON, Authorization: `Bearer ${TARGET_ANON}` },
    body: JSON.stringify({ p_token: token, p_kind: "secrets", p_body: JSON.stringify(values) }),
  });
  return json({ target_status: r.status, sent: Object.keys(values), missing: NAMES.filter((n) => !values[n]) });
});
