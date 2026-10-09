// One-off: test xAI + ElevenLabs keys, and (mode=generate) create the homepage intro ONCE.
// Not scheduled anywhere. Admin-triggered only via SEED_SECRET header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const j = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const { mode } = await req.json().catch(() => ({}));
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg } = await sb.from("brain_ai_config").select("api_key,model,endpoint").limit(1).maybeSingle();
  const dbKey = cfg?.api_key || "";
  const secretKey = Deno.env.get("GROK_API_KEY") || "";
  const xaiKey = secretKey || dbKey;
  const el = Deno.env.get("ELEVENLABS_API_KEY") || "";

  if (mode === "test") {
    const out: Record<string, unknown> = { db_key_present: !!dbKey, secret_present: !!secretKey, same_key: !!dbKey && dbKey === secretKey };
    for (const [name, k] of [["db", dbKey], ["secret", secretKey]] as const) {
      if (!k) continue;
      const r = await fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${k}` } });
      const t = await r.text();
      out[`xai_${name}`] = { status: r.status, models: r.ok ? JSON.parse(t).data?.map((m: any) => m.id) : t.slice(0, 300) };
    }
    if (xaiKey) {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "grok-3-mini", max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
      });
      out.xai_chat = { status: r.status, body: (await r.text()).slice(0, 300) };
    }
    if (el) {
      const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": el } });
      const t = await r.text();
      if (r.ok) { const s = JSON.parse(t); out.eleven = { status: 200, tier: s.tier, used: s.character_count, limit: s.character_limit, remaining: s.character_limit - s.character_count, reset_unix: s.next_character_count_reset_unix }; }
      else out.eleven = { status: r.status, body: t.slice(0, 300) };
    }
    return j(out);
  }

  if (mode === "generate") {
    const g = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${xaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-3-mini", max_tokens: 600, temperature: 0.7,
        messages: [
          { role: "system", content: "You are a senior brand copywriter. Return ONLY JSON." },
          { role: "user", content: `Write a polished, professional homepage hero intro in Polish for "GrouAI Stream" — an AI music radio and streaming platform, built by a solo founder, with a unique catalog of original tracks from registered creators, live 24/7 radio, AI mood DJ, and GrouAI Studio. Premium, confident, warm, not cheesy. Return JSON: {"eyebrow": "<=5 words", "headline": "<=9 words", "sub": "1-2 sentences, <=35 words", "cta_primary": "<=3 words", "cta_secondary": "<=3 words", "voiceover": "spoken radio intro in Polish, 25-35 words, ~12 seconds"}` },
        ],
      }),
    });
    const gt = await g.text();
    if (!g.ok) return j({ step: "grok", status: g.status, body: gt.slice(0, 300) }, 502);
    const content = JSON.parse(gt).choices[0].message.content.replace(/```json|```/g, "").trim();
    const copy = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
    const usage = JSON.parse(gt).usage;

    const v = await fetch("https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128", {
      method: "POST", headers: { "xi-api-key": el, "Content-Type": "application/json" },
      body: JSON.stringify({ text: copy.voiceover, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.6, similarity_boost: 0.78, style: 0.35, use_speaker_boost: true } }),
    });
    if (!v.ok) return j({ step: "eleven", status: v.status, body: (await v.text()).slice(0, 300), copy }, 502);
    const audio = await v.arrayBuffer();
    return j({ copy, grok_usage: usage, chars: copy.voiceover.length, audio_b64: encode(audio) });
  }
  return j({ error: "mode" }, 400);
});
