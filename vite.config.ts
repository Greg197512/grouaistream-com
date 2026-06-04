import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
//
// PWA / Service Worker zostały świadomie usunięte.
// Dlaczego: vite-plugin-pwa z `registerType: "autoUpdate"` + auto-reload
// na controllerchange wpędzało produkcję w pętlę odświeżeń i blokowało
// uploady ("strona pusta, nic nie działa"). Stary SW jest dodatkowo
// wyrejestrowywany w src/main.tsx, żeby usunąć go także u userów,
// którzy mają go już zarejestrowanego w przeglądarce.
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
