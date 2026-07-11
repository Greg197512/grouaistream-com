// Aurora B2B rozmawia przez hub GrouAI (bvstv nie ma klucza OpenRouter, więc
// asystent na LIVE był martwy). Hub zbiera brief i przekazuje zlecenie do
// aurora-worker, która realnie wykonuje pracę — bez n8n. Działa też dla gości
// (funkcja nie wymaga JWT, jest chroniona listą dozwolonych originów).
const HUB_AURORA_B2B_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/aurora-b2b-chat";

export type AuroraChatMsg = { role: "user" | "assistant"; content: string };

export type AuroraB2BResponse = {
  ok: boolean;
  error?: string;
  reply?: string;
  conversation_id?: string;
  brief_state?: any;
  tool_results?: Array<{ tool: string; ok?: boolean; short_id?: string; worker?: string }>;
};

export async function askAuroraB2B(body: {
  message: string;
  conversation_id: string | null;
  history: AuroraChatMsg[];
  client_hint?: { email?: string; full_name?: string };
  order_placed?: boolean;
}): Promise<AuroraB2BResponse> {
  const r = await fetch(HUB_AURORA_B2B_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => null)) as AuroraB2BResponse | null;
  if (!data) return { ok: false, error: `Aurora zwróciła błąd ${r.status}` };
  return data;
}
