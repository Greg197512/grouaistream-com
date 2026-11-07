// GrouAI — worker TYLKO do powiadomień czatu (Web Push), także gdy apka jest zamknięta.
// Celowo: brak handlera 'fetch' i brak cache — nie pośredniczy w żadnych żądaniach,
// więc nie może „zamrozić" starej wersji apki (historia: stary PWA-worker, patrz /sw.js).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { title: "GrouAI", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Hej, jesteś!! 👋";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Apka otwarta i widoczna → sama zawoła głosem (Realtime); nie dublujemy powiadomienia.
    if (wins.some((w) => w.visibilityState === "visible")) {
      wins.forEach((w) => { try { w.postMessage({ type: "grouai-chat-push", ...d }); } catch (_) { /* */ } });
      return;
    }
    await self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/logo-icon.png",
      badge: "/favicon.png",
      tag: d.tag || "grouai-chat",
      renotify: true,
      requireInteraction: true,
      vibrate: [400, 120, 400, 120, 700],
      data: { url: d.url || "/?chat=open" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/?chat=open", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin) {
        try { await w.focus(); w.postMessage({ type: "grouai-chat-open", url }); return; } catch (_) { /* */ }
      }
    }
    await self.clients.openWindow(url);
  })());
});
