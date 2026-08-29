// redeem-code — odbiór kodu wpisanego w pasku wyszukiwania (tylko VIP/admin).
//
// Dostęp to ręczna decyzja admina (rola 'vip' w user_roles, Admin → Użytkownicy),
// nie plan Paddle. Walidacja jest CELOWO po stronie serwera: gdyby lista kodów
// albo lista VIP-ów trafiła do przeglądarki, każdy mógłby to odczytać z devtools.
// Klient wysyła tylko wpisany tekst.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, reason: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Klient "jako user" tylko żeby zweryfikować token i poznać user.id.
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, reason: "unauthorized" }, 401);
  const userId = userData.user.id;

  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code || "").trim();
  } catch { /* brak/zły JSON */ }
  if (!code) return json({ ok: false, reason: "invalid_code" });

  // Od tąd — service_role, żeby ominąć RLS i mieć autorytatywny odczyt.
  const admin = createClient(supabaseUrl, serviceKey);

  // 1) Czy to w ogóle aktywny kod? Jeśli nie — cicho "invalid_code", żeby
  //    front mógł potraktować to jako zwykłe zapytanie wyszukiwania.
  const { data: uc, error: ucErr } = await admin
    .from("unlock_codes")
    .select("id, code, label, is_active")
    .ilike("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (ucErr) return json({ ok: false, reason: "error", detail: ucErr.message }, 500);
  if (!uc) return json({ ok: false, reason: "invalid_code" });

  // 2) Dostęp — nie plan Paddle, tylko ręczna decyzja admina: rola 'vip'
  //    (nadawana w Admin → Użytkownicy) lub 'admin' sam w sobie wystarcza.
  const [{ data: isAdmin }, { data: isVip }] = await Promise.all([
    admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    admin.rpc("has_role", { _user_id: userId, _role: "vip" }),
  ]);

  if (!isAdmin && !isVip) {
    return json({ ok: false, reason: "needs_upgrade", label: uc.label });
  }

  // 3) Zapisz odbiór (idempotentnie — unique(user_id, code_id)).
  const { error: insertErr } = await admin
    .from("code_redemptions")
    .insert({ user_id: userId, code_id: uc.id })
    .select()
    .maybeSingle();

  const already = !!insertErr && /duplicate key|unique/i.test(insertErr.message || "");
  if (insertErr && !already) {
    return json({ ok: false, reason: "error", detail: insertErr.message }, 500);
  }

  return json({ ok: true, label: uc.label, already });
});
