# Project rules

- The welcome screen and homepage share a static intro recording; playback must never invoke paid generation APIs, to prevent recurring spend.
- Welcome-screen animation must be dismissible and time-bounded, with reduced-motion support, so it cannot block access to the application.
- Weekly homepage artwork rotates deterministically through bundled assets by UTC week, without scheduled AI or backend work, to avoid spend and layout disruption.
- Homepage visualization stays inside a fixed-size noninteractive canvas and preserves cross-origin playback fallback, so graphics cannot interfere with audio or controls.

## Cursor Cloud specific instructions

- Install with `npm install`. `package-lock.json` omits packages declared in `package.json` (`@lovable.dev/cloud-auth-js`, `drizzle-kit`, `drizzle-orm`, `postgres`), so a clean install has to resolve those entries.
- Dev server: `npm run dev`. Vite listens on `127.0.0.1:5173` (`vite.config.ts`).
- Tests: `npm test` (Vitest). Production build: `npm run build` (`vite build` and `node scripts/prerender.mjs`).
- `npm run lint` reports a large existing error set in `hub/`, `supabase/functions`, and the app. Treat a non-zero exit as the current baseline.
- The homepage intro (`IntroSplash`) closes with "Przejdź do strony", Escape, or a short timer. Welcome audio is the static public file `INTRO_AUDIO_URL` in `src/lib/introAudio.ts`.
- Local client configuration is already in the committed `.env` and `.env.development` files. Booting the SPA does not need extra secrets.