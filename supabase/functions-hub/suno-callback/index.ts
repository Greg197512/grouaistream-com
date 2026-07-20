// GROUAI HUB — suno-callback
// Odbiornik powiadomień z api.sunoapi.org (generacje Suno V5/V5_5).
// Wynik i tak pobieramy pollingiem record-info w acestep-generate (action=status),
// więc tu wystarczy przyjąć i potwierdzić — brak 200 mógłby oznaczyć task jako błędny.
Deno.serve(async (req) => {
  try { await req.text(); } catch { /* ignorujemy treść */ }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
