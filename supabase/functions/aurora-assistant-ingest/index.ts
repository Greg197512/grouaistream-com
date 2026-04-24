// Aurora Assistant Ingest — uniwersalny webhook dla zewnętrznych kanałów (n8n, formularze, WhatsApp via n8n, Telegram via n8n)
// Wywołuje aurora-assistant-chat wewnętrznie i zwraca odpowiedź do nadawcy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      channel = "api",                 // np. "n8n", "telegram", "whatsapp", "form", "api"
      thread_id,                       // identyfikator rozmowy w kanale (chat_id, email, session)
      message,                         // treść od klienta
      sender = {},                     // { email, phone, full_name, company, external_id:{key,value} }
      conversation_id,                 // jeśli kontynuujesz rozmowę
    } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build client_hint
    const client_hint: any = {};
    if (sender.email) client_hint.email = sender.email;
    if (sender.phone) client_hint.phone = sender.phone;
    if (sender.full_name) client_hint.full_name = sender.full_name;
    if (sender.company) client_hint.company = sender.company;
    if (sender.external_id) client_hint.external_id = sender.external_id;
    else if (thread_id) client_hint.external_id = { key: `${channel}_thread`, value: String(thread_id) };

    // Forward to aurora-assistant-chat
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aurora-assistant-chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        message,
        channel,
        channel_thread_id: thread_id ?? null,
        conversation_id: conversation_id ?? null,
        client_hint,
      }),
    });

    const payload = await res.json();

    return new Response(JSON.stringify(payload), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("aurora-assistant-ingest error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
