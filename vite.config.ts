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
        // Funkcja zamiast listy: do vendor-charts trafiają TYLKO same biblioteki wykresów (+ d3),
        // a nie wspólne drobiazgi (clsx, helpery) — inaczej każda strona ładowała 600 KB wykresów.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // Ostatni segment node_modules: zagnieżdżone kopie (np. recharts/node_modules/clsx) nie są „wykresami”.
          id = "node_modules/" + id.split("node_modules/").pop();
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/@supabase\//.test(id)) return "vendor-supabase";
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return "vendor-motion";
          // Małe wspólne pomocniki osobno — inaczej Rollup dokleja je do wykresów i strona główna ciągnie cały vendor-charts.
          if (/node_modules\/(clsx|tiny-invariant|@babel\/runtime|eventemitter3|react-is|lodash|prop-types|react-smooth|tailwind-merge)\//.test(id)) return "vendor-utils";
          if (/node_modules\/(recharts|recharts-scale|chart\.js|react-chartjs-2|d3-[a-z-]+|victory-vendor)\//.test(id)) return "vendor-charts";
          return undefined;
        },
      },
    },
  },
}));
