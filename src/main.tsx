import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled error/rejection catcher — prevents silent blank screens
window.addEventListener("error", (event) => {
  console.error("[Global] Unhandled error:", event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Global] Unhandled promise rejection:", event.reason);
  event.preventDefault();
});

/**
 * KILL SWITCH dla starego Service Workera.
 *
 * Stary kod robił `window.location.reload()` przy każdym
 * `controllerchange`, co u części użytkowników na produkcji
 * powodowało nieskończoną pętlę odświeżeń i pustą stronę
 * (utwory „pruboją się wgrywać" i się nie wgrywają, bo upload
 *  jest przerywany kolejnym reloadem).
 *
 * Tutaj BEZWARUNKOWO:
 *  1. wyrejestrowujemy WSZYSTKIE service workery,
 *  2. czyścimy WSZYSTKIE cache Workboxa,
 *  3. NIE rejestrujemy nowego SW (PWA wyłączone do odwołania).
 *
 * Aktywowane jest na każdej domenie — preview, prod i custom domain.
 */
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});

  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {});
  }
}

// Program poleceń: zapamiętaj kod z linku (?ref=KOD) — zostanie
// przypisany do konta po rejestracji/pierwszym logowaniu.
try {
  const refCode = new URLSearchParams(window.location.search).get("ref");
  if (refCode && /^[A-Za-z0-9]{4,16}$/.test(refCode)) {
    localStorage.setItem("grouai-ref-code", refCode.toUpperCase());
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(<App />);
