// SELF-DESTRUCT SERVICE WORKER
//
// Historia: aplikacja była kiedyś PWA (vite-plugin-pwa, registerType:"autoUpdate")
// i rejestrowała Service Worker pod tą ścieżką (/sw.js). PWA usunięto, ale u
// użytkowników, którzy DODALI stronę na ekran główny (zainstalowana apka),
// STARY worker dalej żył — serwował STARY, zcache'owany kod aplikacji i
// przechwytywał żądania, przez co żadna nowa poprawka do nich nie docierała,
// a odtwarzanie potrafiło padać ("Nie udało się odtworzyć utworu").
//
// Ten plik zastępuje starego workera wersją, która NIC nie cache'uje i sama się
// wyrejestrowuje: czyści wszystkie cache, usuwa rejestrację i przeładowuje
// otwarte okna na świeżą wersję ze strony. Po tym zainstalowana apka działa jak
// zwykła, zawsze aktualna strona.

self.addEventListener("install", () => {
  // Nie czekaj — od razu przejmij kontrolę, żeby szybko posprzątać.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1) Skasuj wszystkie cache Workboxa/PWA.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_) { /* ignore */ }

      // 2) Wyrejestruj tego workera.
      try { await self.registration.unregister(); } catch (_) { /* ignore */ }

      // 3) Przeładuj wszystkie otwarte okna/karty na świeżą wersję.
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          try { client.navigate(client.url); } catch (_) { /* ignore */ }
        }
      } catch (_) { /* ignore */ }
    })()
  );
});

// KLUCZOWE: nie przechwytujemy fetch. Bez własnego handlera 'fetch' worker nie
// pośredniczy w żadnych żądaniach — audio i kod idą prosto do sieci, nic się nie
// „zacina" na cache'u.
