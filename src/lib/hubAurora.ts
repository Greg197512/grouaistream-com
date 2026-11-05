// Aurora B2B (/business) — rozmowa przez Vercel /api/assistant w trybie „aurora”.
// Stary hub (aurora-b2b-chat) nie istnieje. Gdy klient potwierdzi zlecenie, Aurora dopisuje blok
// [[ORDER]]{…}[[/ORDER]] — zamieniamy go na wynik „place_order” (Business.tsx zapisuje zlecenie
// w aurora_business_orders dla zalogowanego klienta).
import { supabase } from "@/integrations/supabase/client";

export type AuroraChatMsg = { role: "user" | "assistant"; content: string };

export type AuroraB2BResponse = {
  ok: boolean;
  error?: string;
  reply?: string;
  conversation_id?: string;
  brief_state?: any;
  tool_results?: Array<{ tool: string; ok?: boolean; short_id?: string; worker?: string }>;
};

async function readSse(res: Response): Promise<string> {
  const text = await res.text();
  let out = "";
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l.startsWith("data:")) continue;
    const d = l.slice(5).trim();
    if (!d || d === "[DONE]") continue;
    try { out += JSON.parse(d)?.choices?.[0]?.delta?.content ?? ""; } catch { /* */ }
  }
  return out.trim();
}

const shortId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export async function askAuroraB2B(body: {
  message: string;
  conversation_id: string | null;
  history: AuroraChatMsg[];
  client_hint?: { email?: string; full_name?: string };
  order_placed?: boolean;
}): Promise<AuroraB2BResponse> {
  try {
    const hint = body.client_hint?.email ? `\n\n(Znany e-mail klienta: ${body.client_hint.email})` : "";
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "aurora",
        message: body.message + (body.order_placed ? "\n\n(Zlecenie zostało już złożone — nie twórz kolejnego bloku ORDER.)" : "") + hint,
        history: body.history.slice(-12),
      }),
    });
    if (!res.ok) return { ok: false, error: `Aurora zwróciła błąd ${res.status}` };
    const raw = await readSse(res);
    if (!raw) return { ok: false, error: "Aurora nie odpowiada — spróbuj za chwilę" };
    const conversation_id = body.conversation_id || crypto.randomUUID();
    const m = raw.match(/\[\[ORDER\]\]([\s\S]*?)\[\[\/ORDER\]\]/);
    let reply = raw.replace(/\[\[ORDER\]\][\s\S]*?\[\[\/ORDER\]\]/g, "").trim();
    if (!m || body.order_placed) return { ok: true, reply, conversation_id };

    let order: { service_type?: string; brief?: string; email?: string } = {};
    try { order = JSON.parse(m[1]); } catch { return { ok: true, reply, conversation_id }; }
    const { data: s } = await supabase.auth.getSession();
    if (!s?.session) {
      reply += "\n\nAby wysłać zlecenie do zespołu, zaloguj się — zapiszę je w Twoim panelu klienta i odezwiemy się z wyceną.";
      return { ok: true, reply, conversation_id, brief_state: { collected: order } };
    }
    return {
      ok: true,
      reply,
      conversation_id,
      brief_state: { collected: { service_type: order.service_type || "other", brief: order.brief || body.message } },
      tool_results: [{ tool: "place_order", ok: true, short_id: shortId() }],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Błąd połączenia z Aurorą" };
  }
}
