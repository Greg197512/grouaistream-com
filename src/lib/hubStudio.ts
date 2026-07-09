import { supabase } from "@/integrations/supabase/client";

// Silnik ACE-Step działa na hubie GrouAI (funkcja na bvstv woła zły endpoint
// Replicate i nie da się jej podmienić bez Lovable). Hub weryfikuje JWT
// użytkownika przez auth LIVE, więc kontrakt jest identyczny.
const HUB_ACESTEP_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/acestep-generate";

type InvokeResult = { data: any; error: Error | null };

/**
 * Zamiennik supabase.functions.invoke dla silników Studia.
 * "acestep-generate" → hub; pozostałe funkcje → normalnie na LIVE.
 */
export async function invokeStudioEngine(
  fnName: string,
  body: Record<string, unknown>
): Promise<InvokeResult> {
  if (fnName !== "acestep-generate") {
    return supabase.functions.invoke(fnName, { body });
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { data: null, error: new Error("Zaloguj się, aby generować muzykę") };

    const r = await fetch(HUB_ACESTEP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      return { data, error: new Error(data?.error || `Silnik zwrócił błąd ${r.status}`) };
    }
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
