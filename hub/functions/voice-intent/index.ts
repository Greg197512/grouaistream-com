// GROUAI HUB — voice-intent: samouczący się rozpoznawacz komend głosowych.
// Gdy asystent nie rozumie polecenia, ta funkcja:
//  1) sprawdza PAMIĘĆ (voice_intents) — jeśli zna tę frazę, oddaje akcję od razu,
//  2) jak nie zna — pyta AI (OpenRouter) o mapowanie fraza -> akcja z katalogu,
//  3) ZAPAMIĘTUJE nauczone mapowanie -> następnym razem wykona bez AI.
// Dzięki temu asystent „dopisuje sobie funkcje" i uczy się każdej nowej frazy.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Katalog akcji, które front umie WYKONAĆ.
const ACTION_CATALOG = `
play — wznów/graj | pause — zatrzymaj | next — następny | previous — poprzedni
restart — od początku | seek_forward{seconds} — przewiń w przód | seek_back{seconds} — cofnij
seek_end — na koniec | volume_set{percent} — ustaw głośność 0-100 | volume_up | volume_down | mute
repeat_toggle — powtarzanie | shuffle_toggle — losowo | like_current — polub grany utwór
add_queue — dodaj grany do kolejki | split_stems — rozdziel bieżący utwór na ścieżki (wokal/bas/perkusja)
search_play{query,count} — znajdź i graj (gatunek/tytuł/artysta)
play_favorites{count} — graj ulubione | play_recent{count} — graj ostatnio wgrane
navigate{page} — otwórz stronę (home,search,library,liked,server,movies,radio,settings,mood,playlists)
answer — to nie komenda sterująca, tylko pytanie/rozmowa (odpowiedz normalnie)
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hub = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await hub.from("hub_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const row of cfgRows || []) cfg[row.key] = row.value ?? "";

  // Auth: tylko zalogowany user LIVE (asystent i tak działa po zalogowaniu).
  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    const live = createClient(cfg["bvstv_url"], cfg["bvstv_anon_key"], { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await live.auth.getUser();
    if (!u?.user) return json({ ok: false, action: "answer" }, 200);
  } catch { return json({ ok: false, action: "answer" }, 200); }

  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false, action: "answer" }, 200); }
  const command = String(body.command || "").trim();
  const lang = String(body.lang || "pl").slice(0, 2);
  if (command.length < 2) return json({ ok: true, action: "answer" });

  const phrase = norm(command);

  // 1) PAMIĘĆ — znam tę frazę?
  try {
    const { data: known } = await hub.from("voice_intents").select("action, params, hits").eq("phrase", phrase).maybeSingle();
    if (known?.action) {
      hub.from("voice_intents").update({ hits: (known.hits || 1) + 1, updated_at: new Date().toISOString() }).eq("phrase", phrase).then(() => {});
      return json({ ok: true, action: known.action, params: known.params || {}, learned: false, cached: true });
    }
  } catch { /* jedź dalej */ }

  // 2) AI mapuje frazę -> akcję
  const apiKey = cfg["openrouter_api_key"];
  if (!apiKey) return json({ ok: true, action: "answer" });
  const models = (cfg["openrouter_models"] || cfg["openrouter_model"] || "meta-llama/llama-3.3-70b-instruct:free")
    .split(",").map((m) => m.trim()).filter(Boolean);

  const system = `Jesteś tłumaczem poleceń głosowych na akcje aplikacji muzycznej GrouAI Stream. Użytkownik mówi w dowolnym języku/slangu, z błędami. Zrozum INTENCJĘ (jeśli trzeba, wywnioskuj znaczenie nieznanego słowa) i zmapuj na JEDNĄ akcję z katalogu. Jeśli to nie polecenie sterujące muzyką/nawigacją (np. pytanie, rozmowa) → action:"answer".
KATALOG AKCJI:${ACTION_CATALOG}
Zwróć TYLKO JSON: {"action":"<z katalogu>","params":{...},"say":"krótkie potwierdzenie dla usera w jego języku"}. Dla search_play zawsze wypełnij params.query. Liczby (count, seconds, percent) jako number.`;

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://grouaistream.com", "X-Title": "GrouAI Voice Intent" },
        body: JSON.stringify({ model, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: `Polecenie (${lang}): "${command}"` }], max_tokens: 200, temperature: 0.2 }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const out = await res.json();
      const raw = out.choices?.[0]?.message?.content || "";
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch { /* */ } } }
      const action = parsed?.action;
      if (action && typeof action === "string") {
        const params = parsed?.params && typeof parsed.params === "object" ? parsed.params : {};
        // 3) NAUCZ SIĘ (tylko realne akcje sterujące — nie "answer")
        if (action !== "answer" && action !== "none") {
          hub.from("voice_intents").upsert({ phrase, action, params, lang, updated_at: new Date().toISOString() }, { onConflict: "phrase" }).then(() => {});
          hub.from("hub_log").insert({ source: "voice-intent", level: "info", message: `Nauczono: "${phrase}" -> ${action}` }).then(() => {});
        }
        return json({ ok: true, action, params, say: parsed?.say || "", learned: action !== "answer", model });
      }
    } catch { /* następny model */ }
  }

  return json({ ok: true, action: "answer" });
});
