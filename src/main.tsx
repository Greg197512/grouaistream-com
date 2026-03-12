import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Register service worker with auto-update
registerSW({
  onNeedRefresh() {
    // Auto-update when new version available
    console.log("[PWA] New version available, updating...");
  },
  onOfflineReady() {
    console.log("[PWA] App ready for offline use");
  },
  immediate: true,
});

createRoot(document.getElementById("root")!).render(<App />);
