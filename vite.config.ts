import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo-icon.png", "favicon.ico"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(www\.)?grouaistream\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "pages-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 60,
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkOnly",
            options: {
              cacheName: "supabase-api",
            },
          },
          {
            urlPattern: /^https:\/\/pub-.*\.r2\.dev\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "r2-media-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      manifest: {
        name: "GrouAI Stream — DJ Parkiet",
        short_name: "GrouAI DJ",
        description: "AI DJ Rotterdam Peak-Time — dołącz na parkiet, głosuj, reaguj na żywo!",
        theme_color: "#1a1a2e",
        background_color: "#0a0a1a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/logo-icon.png", sizes: "192x192", type: "image/png" },
          { src: "/logo-icon.png", sizes: "512x512", type: "image/png" },
          { src: "/logo-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
