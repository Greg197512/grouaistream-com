import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force PWA cache refresh on new deployments
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => {
      reg.update();
    });
  });

  // Listen for new service worker and force activation
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // New SW took control, reload once to get fresh content
    if (!sessionStorage.getItem('sw-refreshed')) {
      sessionStorage.setItem('sw-refreshed', '1');
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
