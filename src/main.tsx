import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global unhandled error/rejection catcher — prevents silent blank screens
window.addEventListener("error", (event) => {
  console.error("[Global] Unhandled error:", event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Global] Unhandled promise rejection:", event.reason);
  // Prevent blank screen from unhandled async errors
  event.preventDefault();
});

// PWA: iframe/preview guard + force refresh on new deployments
if ('serviceWorker' in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if (isPreviewHost || isInIframe) {
    // Unregister SWs in preview/iframe to avoid stale cache in editor
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(r => r.unregister())
    );
  } else {
    // Production: force SW update + auto-reload on new version
    navigator.serviceWorker.getRegistrations().then(regs =>
      regs.forEach(reg => reg.update())
    );
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('sw-refreshed')) {
        sessionStorage.setItem('sw-refreshed', '1');
        window.location.reload();
      }
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
