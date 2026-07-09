import { supabase } from "@/integrations/supabase/client";

// Silnik ACE-Step działa na hubie GrouAI (funkcja na bvstv woła zły endpoint
// Replicate i nie da się jej podmienić bez Lovable). Hub weryfikuje JWT
// użytkownika przez auth LIVE, więc kontrakt jest identyczny.
const HUB_ACESTEP_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/acestep-generate";
const HUB_PROMPT_ENGINE_URL =
  "https://bmwtydwpevzhbdplilbr.supabase.co/functions/v1/studio-prompt-engine";

type InvokeResult = { data: any; error: Error | null };

/**
 * Zamiennik supabase.functions.invoke dla silników Studia.
 * "acestep-generate" → hub; pozostałe funkcje → normalnie na LIVE.
 */
async function hubFetch(url: string, body: Record<string, unknown>): Promise<InvokeResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { data: null, error: new Error("Zaloguj się, aby generować muzykę") };

    const r = await fetch(url, {
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

export async function invokeStudioEngine(
  fnName: string,
  body: Record<string, unknown>
): Promise<InvokeResult> {
  if (fnName === "acestep-generate") return hubFetch(HUB_ACESTEP_URL, body);
  if (fnName === "studio-prompt-engine") return hubFetch(HUB_PROMPT_ENGINE_URL, body);
  return supabase.functions.invoke(fnName, { body });
}

/**
 * Czeka aż generacja ACE-Step się skończy (odpytuje hub co 4 s).
 * Zwraca adres audio albo rzuca błąd.
 */
export async function waitForAceStep(
  taskId: string,
  generationId?: string | null,
  onTick?: (elapsedSeconds: number) => void
): Promise<string> {
  const maxAttempts = 90; // ~6 minut
  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 4000));
    onTick?.(i * 4);
    const { data, error } = await hubFetch(HUB_ACESTEP_URL, {
      action: "status",
      task_id: taskId,
      generation_id: generationId ?? undefined,
    });
    if (error) continue; // chwilowy błąd sieci — próbujemy dalej
    if (data?.status === "succeeded" && data?.audio_url) return data.audio_url as string;
    if (data?.status === "failed") throw new Error(data?.error || "Generacja nie powiodła się");
  }
  throw new Error("Przekroczono czas oczekiwania na utwór");
}
