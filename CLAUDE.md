# CLAUDE.md — GrouAI Stream

This file is the primary reference for AI assistants working on this codebase. Read it fully before making changes.

---

## Project Overview

**GrouAI Stream** is an AI-powered music streaming platform built for Polish and international audiences. It combines a React SPA frontend, a Supabase backend with 100+ edge functions, and a custom Python/PyTorch AI music generation engine (`groua-engine`).

The product is hosted via the **Lovable.dev** platform (see `.lovable/` directory and `lovable-tagger` in dev dependencies).

---

## Repository Structure

```
grouaistream-com/
├── src/                    # React SPA (TypeScript)
│   ├── App.tsx             # Root: providers + React Router routes
│   ├── main.tsx            # Vite entry point; also unregisters old PWA SW
│   ├── pages/              # One file per route (~35 pages)
│   ├── components/         # Feature-grouped UI components
│   │   ├── ui/             # shadcn/ui primitives (DO NOT edit manually)
│   │   ├── player/         # Audio player components
│   │   ├── admin/          # Admin panel components
│   │   ├── layout/         # Sidebar, nav, shell
│   │   ├── mood/           # Mood detection (face + audio)
│   │   ├── dj/             # DJ-mode components
│   │   ├── radio/          # Radio / live stream UI
│   │   ├── earnings/       # Creator monetization UI
│   │   ├── assistant/      # AI assistant chat UI
│   │   ├── blog/           # Blog display components
│   │   ├── boost/          # Promotion/boost UI
│   │   ├── cards/          # Reusable track/playlist cards
│   │   ├── charts/         # Analytics charts
│   │   ├── cover/          # AI cover art components
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── dnd/            # Drag-and-drop wrappers
│   │   ├── effects/        # Visual effects (confetti, etc.)
│   │   ├── menus/          # Context menus
│   │   ├── modals/         # Overlay dialogs
│   │   ├── payments/       # Payment flow UI
│   │   ├── pwa/            # PWA install prompt
│   │   ├── sections/       # Landing page sections
│   │   ├── settings/       # Settings panel components
│   │   └── studio/         # AI music studio components
│   ├── contexts/           # React Context providers
│   ├── hooks/              # Custom React hooks
│   ├── services/           # External API wrappers
│   ├── integrations/
│   │   ├── supabase/       # Supabase client + auto-generated types
│   │   └── lovable/        # Lovable platform integration
│   ├── utils/              # Pure utility functions
│   ├── i18n/
│   │   └── translations.ts # All UI strings (PL/EN, ~300 KB)
│   └── index.css           # Global Tailwind + CSS variables
├── supabase/
│   ├── functions/          # Deno edge functions (100+)
│   ├── migrations/         # PostgreSQL migration files
│   └── config.toml         # Supabase project config
├── groua-engine/           # Python AI music generation engine
│   ├── groua/              # Core Python package
│   ├── app/api.py          # FastAPI inference server
│   ├── scripts/            # Training pipeline scripts
│   ├── configs/            # YAML model/training config
│   ├── requirements.txt    # Python deps
│   └── Dockerfile          # CUDA-ready container
├── public/                 # Static assets
├── index.html              # Vite HTML entry
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.app.json
├── components.json         # shadcn/ui config
└── package.json
```

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18, TypeScript 5 |
| Build tool | Vite 7 (SWC plugin) |
| Styling | Tailwind CSS 3 + CSS custom properties |
| UI components | shadcn/ui (Radix UI primitives) |
| Routing | react-router-dom v6 |
| Data fetching | TanStack React Query v5 |
| Forms | react-hook-form + zod |
| Animation | framer-motion |
| Audio playback | wavesurfer.js |
| 3D / WebGL | @react-three/fiber + @react-three/drei |
| ML in-browser | TensorFlow.js + @vladmandic/face-api |
| Drag & drop | @dnd-kit/core + @hello-pangea/dnd |
| Rich text | Tiptap |
| Charts | recharts + chart.js/react-chartjs-2 |
| Exports | jsPDF, xlsx, file-saver, html-to-docx-buffer |
| Testing | Vitest + @testing-library/react |
| Linting | ESLint 9 (flat config) |

### Backend
| Layer | Technology |
|---|---|
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Edge Functions | Deno TypeScript (100+ functions) |
| Storage | Supabase Storage + Cloudflare R2 |
| Payments | Paddle |
| AI music (external) | Suno API, Replicate (MusicGen), ElevenLabs |
| TTS / Voice | ElevenLabs |
| Email | Custom send-email function |
| Video | YouTube Data API |

### groua-engine (Python)
| Component | Technology |
|---|---|
| Framework | PyTorch + torchaudio |
| Text encoder | T5 / CLIP-Text (via Transformers) |
| Diffusion | Custom U-Net (latent diffusion) |
| Autoencoder | VQ-VAE |
| Vocoder | HiFi-GAN |
| Audio processing | librosa, soundfile, ffmpeg-python |
| API server | FastAPI + uvicorn |
| Export | ONNX |
| Monitoring | wandb, tensorboard |

---

## Development Commands

```bash
# Frontend dev server (port 8080)
npm run dev

# Production build
npm run build

# Development build
npm run build:dev

# Lint
npm run lint

# Tests (run once)
npm run test

# Tests (watch mode)
npm run test:watch

# Preview production build
npm run preview
```

```bash
# groua-engine: setup
cd groua-engine
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# groua-engine: start API server
uvicorn app.api:app --host 0.0.0.0 --port 8000

# groua-engine: generate audio (CLI)
python scripts/generate.py --prompt "dark cinematic synthwave" --duration 30 --out output.wav
```

---

## Routing Map (`src/App.tsx`)

| Path | Page | Description |
|---|---|---|
| `/` | Index | Home / main dashboard |
| `/auth` | Auth | Login / registration |
| `/search` | Search | Track/playlist search |
| `/library` | Library | User music library |
| `/liked` | LikedSongs | Liked tracks |
| `/create-playlist` | CreatePlaylist | Playlist creation |
| `/playlist/:id` | PlaylistDetail | Single playlist view |
| `/playlist-manager` | PlaylistManager | Manage all playlists |
| `/radio` | Radio | Radio stations |
| `/radio-live` | RadioLive | Live radio broadcast |
| `/radio-live/embed` | RadioEmbed | Embeddable radio player |
| `/import-youtube` | ImportYouTube | YouTube import tool |
| `/settings` | Settings | User settings |
| `/mood-history` | MoodHistory | Mood analytics |
| `/movies` | Movies | Movie soundtrack mode |
| `/server` | Server | Server/community hub |
| `/admin` | Admin | Admin panel |
| `/admin/brain` | AdminBrain | AI brain management |
| `/admin/aurora` | AdminAurora | Aurora AI system |
| `/legal` | Legal | Legal documents |
| `/party/:code` | PartyPulpit | Shared party mode |
| `/suno` | Suno | AI music generation (Suno) |
| `/local-player` | LocalPlayer | Local file player |
| `/upload` | Upload | Track upload |
| `/my-tracks` | MyTracks | Artist's own tracks |
| `/album-creator` | AlbumCreator | Album creation tool |
| `/earnings` | CreatorEarnings | Creator earnings dashboard |
| `/earn` | EarnWithUs | Monetization info |
| `/blog` | BlogIndex | Blog listing |
| `/blog/:slug` | BlogPost | Single blog post |
| `/reklama/:token` | AdSubmission | Ad campaign submission |
| `/orders` | Orders | Order management |
| `/n/:slug` | NicheLandingPage | Niche-specific landing |
| `/sponsor` | Sponsor | Sponsorship page |
| `/business` | Business | B2B / business portal |
| `/dla-firm` | Business | Polish alias for business |
| `/client-dashboard` | ClientDashboard | B2B client view |
| `/unsubscribe` | Unsubscribe | Email unsubscribe |

---

## State Management — React Contexts

Providers are nested in this order (outermost first) in `src/App.tsx`:

```
ErrorBoundary
  QueryClientProvider      ← TanStack React Query cache
    LanguageProvider       ← PL/EN language toggle
      AuthProvider         ← Supabase auth session + isFirstLogin
        SubscriptionProvider ← Paddle subscription tier
          PlayerProvider   ← Audio player state (track, queue, playback)
            AIProvider     ← AI feature flags and state
              TooltipProvider
```

### Context files (`src/contexts/`)

| File | Purpose |
|---|---|
| `AuthContext.tsx` | Supabase session, user object, `isFirstLogin`, `clearFirstLogin` |
| `PlayerContext.tsx` | Current track, queue, play/pause, volume, seek, shuffle, repeat |
| `AIContext.tsx` | AI mode state, model selection |
| `LanguageContext.tsx` | Active language (`pl`/`en`), `t()` translation function |
| `SubscriptionContext.tsx` | Subscription tier, feature gates |
| `DragDropContext.tsx` | Shared drag-and-drop state for playlist reordering |

---

## Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|---|---|
| `useAIOrchestrator` | Coordinates AI suggestions, skip adaptation, mood signals |
| `useAILearning` | Persists user taste model to Supabase |
| `useAdminAuth` | Checks admin role from Supabase |
| `useAssistantConfig` | AI assistant personality config |
| `useAudioAnalyser` | Web Audio API frequency/waveform analysis |
| `useClapControl` | Mic-based clap gesture detection |
| `useDJMode` | Auto-DJ crossfade and BPM matching |
| `useFaceDetection` | Camera face detection → mood inference via face-api.js |
| `useLazyLoad` | IntersectionObserver-based lazy loading |
| `useNotificationsFeed` | Supabase Realtime notification subscription |
| `useSkipAdaptation` | Learns which tracks the user skips |
| `useStreamCounter` | Increments stream count in Supabase |
| `useTimeRotation` | Time-of-day-aware content rotation |
| `useTipWallet` | Creator tip wallet balance |
| `use-mobile` | Responsive breakpoint detection |
| `use-toast` | shadcn/ui toast system |

---

## Supabase Integration

### Client
Import the Supabase client from:
```typescript
import { supabase } from '@/integrations/supabase/client';
```
Never construct a new client — always use this singleton.

### Types
Database types are auto-generated at `src/integrations/supabase/types.ts`. This file is 190+ KB and should not be hand-edited. Regenerate with:
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

### Migrations
All schema changes go in `supabase/migrations/` as numbered SQL files. Never alter the database schema directly.

### Edge Functions
Edge functions live in `supabase/functions/<name>/index.ts` (Deno TypeScript). Shared utilities are in `supabase/functions/_shared/`.

**Deploy a single function:**
```bash
npx supabase functions deploy <function-name>
```

---

## Edge Functions Reference

Over 100 edge functions are grouped by domain:

### AI & Music Generation
| Function | Purpose |
|---|---|
| `suno-generate` | Generate music via Suno API |
| `suno-resolve` | Resolve/poll Suno generation result |
| `replicate-music` | Generate via Replicate (generic) |
| `replicate-musicgen` | MusicGen model on Replicate |
| `groua-music-engine` | Custom groua-engine endpoint |
| `elevenlabs-music` | ElevenLabs music generation |
| `elevenlabs-tts` | Text-to-speech |
| `elevenlabs-voice-clone` | Voice cloning |
| `studio-generate` | AI studio track generation |
| `studio-chat` | AI studio conversational UI |
| `studio-prompt-engine` | Prompt engineering for studio |
| `studio-router` | Routes studio requests to correct model |

### AI Features
| Function | Purpose |
|---|---|
| `ai-assistant` | General AI assistant chat |
| `ai-categorize` | Auto-categorize tracks |
| `ai-cover` | Generate cover art |
| `ai-cover-generate` | Extended cover generation |
| `ai-mood-analysis` | Analyze mood from audio features |
| `ai-mix-suggest` | DJ mix suggestions |
| `ai-moderate-track` | Content moderation |
| `ai-music-shrink` | Compress/edit music |
| `ai-playlist` | Auto-generate playlists |
| `ai-psychologist` | Mood-based music therapy |
| `ai-suggest-tracks` | Personalized track recommendations |
| `ai-vision-mood` | Computer vision mood detection |
| `ai-voice-answer` | Voice query answering |
| `ai-learn` | User preference learning |
| `ai-builder-stats` | AI usage statistics |

### Aurora — Autonomous AI System
Aurora is the platform's autonomous AI agent for business operations:
| Function | Purpose |
|---|---|
| `aurora-assistant-chat` | Conversational business AI |
| `aurora-autopilot` | Autonomous task execution |
| `aurora-business-intake` | Onboard new B2B clients |
| `aurora-plan-generate` | Generate business plans |
| `aurora-order-execute` | Execute client orders |
| `aurora-revenue-loop` | Revenue optimization loop |
| `aurora-content-refresher` | Auto-update content |
| `aurora-niche-scanner` | Discover new market niches |
| `aurora-launch-niche` | Launch niche landing pages |
| `aurora-niche-pruner` | Remove underperforming niches |
| `aurora-workforce-dispatch` | Task routing to AI workers |
| `aurora-invoice-generate` | B2B invoice creation |
| `aurora-ab-evaluator` | A/B test evaluation |
| `aurora-iq-tick` | Scheduled intelligence update |
| `aurora-auto-learn` | Autonomous learning loop |
| `aurora-web-learn` | Web scraping for learning |
| `aurora-ai-dialogue` | Internal AI dialogue |
| `aurora-change-negotiate` | Contract/change negotiation |
| `aurora-approve-action` | Human approval gate for actions |
| `aurora-n8n-trigger` | Trigger n8n workflows |
| `aurora-n8n-callback` | Receive n8n callbacks |
| `aurora-storage-offer-create` | Create storage offers |
| `aurora-storage-usage-report` | Usage analytics |
| `aurora-r2-deliverable-upload` | Upload deliverables to R2 |
| `aurora-r2-signed-download` | Signed download URLs from R2 |
| `aurora-track-event` | Track business events |
| `aurora-assistant-ingest` | Ingest data for assistant |

### Media & Content
| Function | Purpose |
|---|---|
| `youtube-download` | Download YouTube audio |
| `youtube-match` | Match tracks to YouTube videos |
| `auto-youtube-fetch` | Automated YouTube fetching |
| `movie-youtube-search` | Search YouTube for movie soundtracks |
| `spotify-import` | Import from Spotify |
| `ccmixter-proxy` | Proxy for ccMixter API |
| `cover-search` | Search for cover art |
| `bulk-populate` | Bulk populate track database |
| `bulk-populate-movies` | Bulk populate movie data |
| `bulk-audio-features` | Extract audio features in bulk |
| `n8n-music-ingest` | Ingest music via n8n |
| `radio-top10-sync` | Sync top 10 radio charts |

### SEO & Blog
| Function | Purpose |
|---|---|
| `seo-blog-generate` | Auto-generate SEO blog posts |
| `seo-orchestrator` | Coordinate SEO tasks |
| `seo-sitemap-generate` | Generate XML sitemap |
| `indexnow-ping` | Ping search engines via IndexNow |
| `blog-translate` | Translate blog posts |
| `music-stories-generate` | Generate music story content |
| `music-story-radio-announce` | Radio-style story announcements |
| `daily-blog-audio-announce` | Daily audio blog announcements |
| `tiktok-reel-generate` | Generate TikTok reel content |
| `tiktok-story-generate` | Generate TikTok story content |
| `a-r-scout` | A&R talent scouting |

### Payments & Business
| Function | Purpose |
|---|---|
| `payments-webhook` | Paddle webhook handler |
| `customer-portal` | Paddle customer portal redirect |
| `get-paddle-price` | Fetch Paddle pricing |
| `download-paddle-invoice` | Download Paddle invoice |
| `ad-campaign-submit` | Submit ad campaign |
| `ad-lead-lookup` | Look up ad leads |
| `ad-outreach-process` | Process ad outreach |
| `break-even-alert` | Alert on break-even threshold |
| `monthly-cost-report` | Monthly cost reporting |
| `revenue-optimizer` | Revenue optimization suggestions |
| `generate-weekend-challenge` | Weekend promotion generation |

### Email
| Function | Purpose |
|---|---|
| `send-email` | Send transactional email |
| `generate-email` | Generate email content with AI |
| `send-transactional-email` | Structured transactional email |
| `preview-transactional-email` | Preview email before send |
| `process-email-queue` | Process queued emails |
| `mass-email-dispatch` | Bulk email dispatch |
| `newsletter-subscribe-notify` | New subscriber notification |
| `notify-blog-subscribers` | Blog post notifications |
| `handle-email-unsubscribe` | Handle unsubscribe requests |
| `handle-email-suppression` | Manage email suppression list |
| `auth-email-hook` | Supabase auth email customization |
| `cancel-reminder-cron` | Churn prevention reminders |
| `daily-cc-fetch` | Daily Creative Commons fetch |

### Storage & Infrastructure
| Function | Purpose |
|---|---|
| `r2-signed-url` | Generate Cloudflare R2 signed URLs |
| `r2-upload-proxy` | Proxy uploads to Cloudflare R2 |
| `health-monitor` | Service health monitoring |

### AI Brain / Knowledge
| Function | Purpose |
|---|---|
| `grouai-brain` | Central AI knowledge system |
| `brain-backfill-embeddings` | Backfill vector embeddings |
| `brain-newsfeed-ingest` | Ingest news for knowledge base |
| `soul-dream` | Creative AI generation |
| `soul-export` | Export AI personality data |
| `soul-world-ingest` | World knowledge ingestion |
| `groua-soul` | Core personality/soul module |
| `batch-fill-covers` | Batch cover art generation |

---

## groua-engine — AI Music Generation

The `groua-engine/` directory is a self-contained Python project for training and serving a custom text-to-music AI model.

### Architecture
```
Prompt (text)
  → T5/CLIP text encoder
  → Latent diffusion U-Net (DDPM/DDIM)
  → VQ-VAE decoder
  → HiFi-GAN vocoder
  → Waveform (16-bit PCM WAV)
```

### Package structure (`groua-engine/groua/`)
| File | Purpose |
|---|---|
| `encoder.py` | T5/CLIP text encoder wrapper |
| `autoencoder.py` | VQ-VAE audio ↔ latent |
| `diffusion.py` | U-Net + DDPM/DDIM scheduler |
| `vocoder.py` | HiFi-GAN mel → waveform |
| `model.py` | Full pipeline assembly |
| `utils.py` | mel↔wav conversion, logging, schedulers |

### Inference API (`groua-engine/app/api.py`)
- `GET /health` — liveness check
- `POST /generate` — generate audio
  - Body: `{ prompt, duration (0.5–120s), steps (10–200), guidance (1–20), seed? }`
  - Returns: WAV audio stream

### Training pipeline
| Step | Script | Output |
|---|---|---|
| 1. Prepare data | `scripts/prepare_data.py` | mel-spec + CSV |
| 2. Train VQ-VAE | `scripts/train_autoencoder.py` | `autoencoder.pt` |
| 3. Train diffusion | `scripts/train_diffusion.py` | `diffusion.pt` |
| 4. Fine-tune vocoder | `scripts/train_vocoder.py` | `vocoder.pt` |
| 5. Evaluate | `scripts/evaluate.py` | `metrics.json` |
| 6. Serve API | `app/api.py` | `localhost:8000` |
| 7. Export ONNX | `scripts/export_onnx.py` | `groua_music.onnx` |

### Integration roadmap
1. Export trained model to ONNX → upload to Replicate or HuggingFace Hub
2. Create `groua-music-engine` edge function pointing at the hosted model
3. Replace `suno-generate` references in the UI with the custom engine
4. `REPLICATE_API_TOKEN` secret is already configured in Supabase

---

## Key Conventions

### Path alias
`@` resolves to `src/`. Always use `@/` imports, never relative paths that traverse upward.

```typescript
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
```

### Dark mode
The app is always dark. `className="dark"` is set on the root `<div>` in `App.tsx`. CSS variables in `src/index.css` are defined for the dark theme only. Do not add light-mode variants.

### UI components
- Use **shadcn/ui** components from `src/components/ui/` for all primitive UI elements (buttons, inputs, dialogs, etc.).
- Do not install new UI libraries without discussion. Radix UI primitives are already available through shadcn.
- The `components.json` at the root configures shadcn paths and style.

### Styling
- Use **Tailwind utility classes** for all styling. Avoid inline `style` props unless necessary for dynamic values.
- CSS custom properties (HSL color tokens) are defined in `src/index.css`.
- Custom Tailwind config is in `tailwind.config.ts` — check it before adding new colors or animation values.

### Translations / i18n
- All user-visible strings should use the `t()` function from `useLanguage()` hook.
- Translations are in `src/i18n/translations.ts` as a large nested object.
- The app defaults to Polish (`pl`) with English (`en`) as the secondary language.
- Do not hardcode Polish or English strings directly in JSX — always add them to `translations.ts`.

### React Query
The global `QueryClient` in `App.tsx` is configured with:
- `staleTime: 5min` — avoid over-fetching
- `gcTime: 10min` — conservative memory
- `retry: 1` — single retry only
- `refetchOnWindowFocus: false`

Match this pattern for all new queries. Do not configure individual queries with aggressive polling unless strictly necessary.

### Forms
Use `react-hook-form` + `zod` for all forms. Define a zod schema, pass it to `useForm` via `zodResolver`.

### Error boundaries
- `ErrorBoundary` wraps the entire app.
- `SectionErrorBoundary` is available for wrapping individual risky sections without crashing the page.

### Audio / Player
- All playback state lives in `PlayerContext`. Never manage local audio state outside of it.
- Use `wavesurfer.js` for waveform visualization.
- The PWA Service Worker was intentionally removed (it caused reload loops on uploads). Do not re-add it without addressing the root cause.

### Supabase access
- Always go through `src/integrations/supabase/client.ts` singleton.
- Use the generated types from `src/integrations/supabase/types.ts` for all DB queries.
- Row Level Security is active — write RLS policies in migrations, not in application code.

### Cloudflare R2
- Large file storage (audio, video, deliverables) goes to Cloudflare R2, not Supabase Storage.
- Use `r2-signed-url` and `r2-upload-proxy` edge functions.

### Payments
- Payments are processed via **Paddle**.
- Never hardcode price IDs — fetch them via `get-paddle-price` edge function.
- Webhook handling is in `payments-webhook` edge function.

---

## Environment Variables

Three `.env` files exist at the root:
- `.env` — shared defaults
- `.env.development` — development overrides
- `.env.production` — production overrides

Key variables (never commit real values):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_LOVABLE_PROJECT_ID
```

Edge function secrets are managed in Supabase dashboard, not in `.env` files.

---

## Testing

- Framework: **Vitest** + **@testing-library/react**
- Config: `vitest.config.ts`
- Test files: `src/test/`
- Run: `npm run test` (one-shot) or `npm run test:watch` (watch)

The test suite is minimal. When adding new logic, add a test in `src/test/`.

---

## Git Workflow

- Main branch: `main` (production)
- Feature branches: `claude/<feature-name>-<id>` for AI-assisted work
- Never push directly to `main`
- Commit messages: use conventional commit format (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)

---

## Common Pitfalls

1. **PWA / Service Worker**: Do not re-add `vite-plugin-pwa`. It was removed intentionally — it caused a reload loop on uploads. The old SW is unregistered in `src/main.tsx`.

2. **Supabase types**: `src/integrations/supabase/types.ts` is auto-generated. Never edit it by hand. Regenerate after schema changes.

3. **Translation keys**: Adding strings without translation entries causes runtime `undefined` display. Always add to both `pl` and `en` in `src/i18n/translations.ts`.

4. **QueryClient retries**: The global client has `retry: 1`. Do not override to higher values on individual queries — it causes memory pressure.

5. **CORS on groua-engine**: The FastAPI server uses `allow_origins=["*"]`. Restrict this in production deployment.

6. **Bun vs npm**: The repo has both `bun.lock` and `package-lock.json`. Use `npm` for CI/CD consistency unless the team has standardized on Bun.

7. **Dark mode only**: The CSS variable palette only defines dark-mode values. Adding `light` variants will break the design system.

8. **Edge function limits**: Supabase Edge Functions run in Deno — no Node.js APIs. Use `std/` and npm compatibility layer (`npm:` prefix) carefully.

---

## Second Repository

`greg197512/-1-sklonuj-repozytorium-git-clone-...` is a stub repository (single README) created as part of a tutorial exercise. It has no meaningful content and is not related to the main platform.
