import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-podziękowanie na pasku, gdy twórca wystawi utwory.
 * — Jeden wpis na twórcę na dobę (dedupe w localStorage), żeby wgranie 10
 *   utworów nie zasypało paska dziesięcioma wiadomościami.
 * — Best-effort: jeśli RLS nie pozwala zwykłemu userowi pisać na pasek,
 *   po cichu pomijamy (bez błędu dla użytkownika).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function postCreatorThankYou(userId: string, artist: string): Promise<void> {
  if (!userId) return;
  const guardKey = `grouai-thanks-posted-${userId}`;
  try {
    const last = Number(localStorage.getItem(guardKey) || "0");
    if (Date.now() - last < DAY_MS) return; // już dziś dziękowaliśmy temu twórcy
  } catch {
    /* brak localStorage — próbujemy dalej */
  }

  const name = (artist || "").trim() || "Nowy twórca";
  const message =
    `🎶 Brawa dla „${name}"! Nowe utwory właśnie trafiły na GrouAI Stream — ` +
    `dziękujemy, że tworzysz z nami! Odsłuchaj i zostaw serce ❤️ — GrouaRock & GrouAI Stream`;

  try {
    const { error } = await supabase.from("admin_marquee_messages").insert({
      message,
      created_by: userId,
      is_active: true,
      expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    if (!error) {
      try { localStorage.setItem(guardKey, String(Date.now())); } catch { /* ignore */ }
    }
  } catch {
    /* RLS/inny błąd — pasek i tak nie jest krytyczny */
  }
}
