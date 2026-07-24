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
    host: "127.0.0.1",
    port: 5173,
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
  build: {
    rollupOptions: {
      output: {
        // Stabilne chunki vendorów — rzadko się zmieniają, więc po deployu
        // przeglądarki użytkowników trzymają je w cache i pobierają tylko
        // mały chunk z kodem aplikacji.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-motion": ["framer-motion"],
          "vendor-charts": ["recharts", "chart.js", "react-chartjs-2"],
        },
      },
    },
  },
}));
