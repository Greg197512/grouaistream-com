# CLAUDE.md - Groua AI Stream Development Guide

## Project Overview

**Groua AI Stream** is a comprehensive music streaming and AI-powered content creation platform built with modern web technologies. It features music playback, DJ tools, AI-driven content generation (via Suno), mood-based music discovery, and a creator economy platform with earnings management.

### Key URLs
- **Production**: https://grouaistream.com (hosted on Lovable)
- **Backup/Preview**: https://*.vercel.app (Vercel deployment)
- **Email**: grzegorzkaron553@gmail.com

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Radix UI + Tailwind CSS
- **Styling**: Tailwind CSS 3 + Framer Motion
- **State Management**: React Context API + TanStack React Query
- **Backend/Database**: Supabase (PostgreSQL + Auth)
- **Authentication**: Lovable Cloud Auth + Supabase Auth
- **Build Tool**: Vite with SWC
- **Package Manager**: npm/bun
- **Testing**: Vitest
- **Deployment**: Lovable (primary) + Vercel (backup)

---

## Directory Structure

```
/home/user/grouaistream-com/
├── src/
│   ├── App.tsx                 # Main app component with routing
│   ├── main.tsx                # Entry point, global error handlers, PWA cleanup
│   ├── index.css               # Global styles
│   ├── assets/                 # Static assets (covers, genres, library)
│   ├── components/             # React components (29 subdirectories)
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── admin/              # Admin dashboard components
│   │   ├── player/             # Music player controls
│   │   ├── studio/             # Content creation/DJ tools
│   │   ├── dashboard/          # User dashboard views
│   │   ├── effects/            # Visual effects (Aurora, Particles, etc.)
│   │   ├── layout/             # Layout wrappers
│   │   ├── modals/             # Dialog/modal components
│   │   ├── sections/           # Page sections
│   │   ├── cards/              # Card components
│   │   ├── charts/             # Chart/analytics components
│   │   └── [other domains]/    # Feature-specific components
│   ├── contexts/               # React Context providers (7 total)
│   │   ├── AuthContext.tsx     # User authentication
│   │   ├── PlayerContext.tsx   # Music player state
│   │   ├── SubscriptionContext # Subscription/billing
│   │   ├── AIContext.tsx       # AI features state
│   │   ├── Effects3DContext    # 3D visual effects
│   │   ├── LanguageContext     # i18n/localization
│   │   └── DragDropContext     # Drag & drop state
│   ├── hooks/                  # Custom React hooks
│   ├── pages/                  # Page components (40+ pages)
│   │   ├── empire/             # Empire platform pages (6 pages)
│   │   ├── Index.tsx           # Home page
│   │   ├── Auth.tsx            # Login/signup
│   │   ├── Library.tsx         # Music library
│   │   ├── Search.tsx          # Search functionality
│   │   ├── Admin.tsx           # Admin dashboard
│   │   ├── Suno.tsx            # AI music generation
│   │   ├── Studio/             # DJ/production tools
│   │   └── [other pages]/      # Feature pages
│   ├── services/               # Business logic services
│   │   ├── apifyService.ts     # Web scraping service
│   │   └── ccMixterService.ts  # Music mixing service
│   ├── integrations/           # External service integrations
│   │   ├── supabase/           # Supabase client setup
│   │   └── lovable/            # Lovable platform integration
│   ├── utils/                  # Utility functions
│   ├── lib/                    # Library utilities
│   ├── i18n/                   # Internationalization
│   └── test/                   # Test utilities
├── groua-engine/               # Python backend (separate monorepo)
│   ├── app/                    # FastAPI application
│   ├── groua/                  # Core engine logic
│   ├── configs/                # Configuration files
│   ├── scripts/                # Deployment/utility scripts
│   ├── Dockerfile              # Container setup
│   └── requirements.txt        # Python dependencies
├── hub/                        # Secondary directory (purpose TBD)
├── supabase/                   # Supabase configuration
│   ├── migrations/             # Database schema migrations
│   ├── functions/              # Edge functions
│   └── seeds/                  # Database seed data
├── scripts/                    # NPM scripts
│   └── prerender.mjs          # Static site pre-rendering
├── public/                     # Static files served as-is
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD for Vercel deployment
├── .claude/
│   └── settings.local.json    # Claude Code local settings
├── Configuration Files
│   ├── package.json           # NPM dependencies and scripts
│   ├── vite.config.ts         # Vite build configuration
│   ├── tailwind.config.ts     # Tailwind CSS theme
│   ├── tsconfig.app.json      # TypeScript compiler options
│   ├── vitest.config.ts       # Test runner config
│   ├── eslint.config.js       # Linting rules
│   ├── components.json        # shadcn/ui config
│   ├── postcss.config.js      # CSS processing
│   ├── vercel.json            # Vercel deployment config
│   └── .env*                  # Environment variables
└── Documentation Files
    ├── README.md              # Project setup guide
    ├── CLAUDE.md             # This file
    └── Other marketing docs  # GOOGLE_ADS_PLAN.md, etc.
```

---

## Core Concepts

### 1. Architecture Pattern: Context + Lazy Routes

The app uses **React Context** for global state and **lazy-loaded routes** for code splitting:

```typescript
// Heavy components only load when their route is accessed
const Suno = lazy(() => import("./pages/Suno"));      // AI music gen
const Admin = lazy(() => import("./pages/Admin"));    // Analytics
const Studio = lazy(() => import("./pages/Studio"));  // DJ tools
```

**Why**: Keeps the main bundle small. Heavy libraries (face-api, tiptap, xlsx, jspdf, wavesurfer) only ship when needed.

### 2. Global State Management

- **AuthContext**: User authentication, login state, account info
- **PlayerContext**: Current song, playlist, playback state, queue
- **SubscriptionContext**: User subscription tier, billing, features
- **AIContext**: AI features availability and settings
- **Effects3DContext**: 3D visual effects state
- **LanguageContext**: i18n language selection
- **DragDropContext**: Drag-and-drop operations (playlists, etc.)

### 3. Pages & Routes

The app has **40+ pages** organized by feature domain:

**Core Pages** (always loaded):
- `Index.tsx` — Home/landing
- `Auth.tsx` — Login/signup
- `NotFound.tsx` — 404 fallback

**Main Features** (lazy-loaded):
- Music: `Library.tsx`, `Search.tsx`, `LikedSongs.tsx`, `Radio.tsx`
- Creation: `Studio.tsx`, `Suno.tsx` (AI music gen), `Upload.tsx`
- User: `Settings.tsx`, `Orders.tsx`, `MyTracks.tsx`
- Creator Economy: `CreatorEarnings.tsx`, `EarnWithUs.tsx`, `AlbumCreator.tsx`
- Admin: `Admin.tsx`, `AdminAurora.tsx`, `AdminBrain.tsx`, `AdminSEO.tsx`
- **Empire Platform** (separate subsystem): Dashboard, Projects, AgentBuilder, etc.

### 4. Component Organization

Components are organized by **feature domain**:

```
components/
├── ui/               # Base components (Button, Dialog, etc.)
├── admin/            # Admin dashboards & analytics
├── player/           # Music playback UI
├── studio/           # DJ/production tools
├── dashboard/        # User dashboards
├── effects/          # Visual effects (Aurora, Particles, etc.)
├── layout/           # Reusable layouts
├── modals/           # Dialogs and modals
├── cards/            # Card layouts
├── charts/           # Analytics charts
├── [features]/       # Feature-specific (boost, blog, payments, etc.)
└── sections/         # Page sections
```

---

## Key Files & Critical Functions

### Entry Points
- **`src/main.tsx`**
  - Unregisters old Service Workers (prevents infinite reload loops)
  - Captures unhandled errors globally
  - Handles referral code from `?ref=CODE` URL param
  - Auto-reloads app after 25 min idle (keeps PWA-like app fresh)

- **`src/App.tsx`**
  - Wraps app in providers (Auth, Query, Theme, Router)
  - Defines all routes and lazy-loaded pages
  - Includes error boundary and global modals

### Critical Contexts
- **`AuthContext.tsx`** — Manages Supabase auth, session, user profile
- **`PlayerContext.tsx`** — Large file (28KB) managing music playback state
- **`SubscriptionContext.tsx`** — Handles subscription logic and feature gates

### Services
- **`apifyService.ts`** — Web scraping (likely for competitor analysis)
- **`ccMixterService.ts`** — Music mixing/audio processing

### Configuration
- **`vite.config.ts`** — Build optimization with manual vendor chunks
- **`tailwind.config.ts`** — Design system colors and spacing
- **`tsconfig.app.json`** — Relaxed TypeScript settings (`noImplicitAny: false`, `strict: false`)

---

## Development Workflows

### 1. Local Development

```bash
# Install dependencies
npm install
# or
bun install

# Start dev server (HMR enabled)
npm run dev
# Runs on http://localhost:8080

# Watch tests
npm run test:watch
```

### 2. Building & Deployment

```bash
# Production build with pre-rendering
npm run build
# Runs: vite build + prerender.mjs
# Output: dist/ directory

# Development build (for testing)
npm run build:dev

# Preview production build locally
npm run preview
```

### 3. Code Quality

```bash
# Lint all files
npm run lint
# Uses ESLint (eslint.config.js)

# Run tests
npm run test
# Uses Vitest (vitest.config.ts)
```

### 4. Deployment Strategy

**Primary** (Production):
- **Lovable** (https://grouaistream.com)
- Changes pushed to `main` branch auto-deploy
- Lovable provides hosting, CDN, and custom domain

**Backup** (Always ready):
- **Vercel** (https://*.vercel.app)
- GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys `main` to Vercel
- DNS can be switched anytime to failover without rebuild
- Requires GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

**Branch Strategy**:
- Work on feature branches (e.g., `claude/feature-name`)
- Push to designated branch, create PR
- PR auto-deploys to preview URL
- Merge to `main` triggers production deployment

---

## Conventions & Patterns

### 1. Component Structure

**Functional Components Only** — No class components.

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function MyComponent() {
  const [state, setState] = useState<T>(initial);
  const navigate = useNavigate();

  return <div>{/* UI */}</div>;
}

export default MyComponent;
```

### 2. Styling

**Tailwind CSS** with `clsx` for conditional classes:

```typescript
import clsx from 'clsx';

export function Button({ variant = 'primary' }) {
  return (
    <button
      className={clsx(
        'px-4 py-2 rounded transition',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'outline' && 'border border-gray-300'
      )}
    >
      Click me
    </button>
  );
}
```

**Do NOT** create inline CSS objects or `.module.css` files.

### 3. Data Fetching

Use **TanStack React Query** for server state:

```typescript
import { useQuery } from '@tanstack/react-query';

export function UserProfile() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => supabase.from('users').select().eq('id', userId),
  });

  if (isLoading) return <Skeleton />;
  return <div>{user.name}</div>;
}
```

### 4. Form Handling

Use **react-hook-form** + **Zod** for validation:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
    </form>
  );
}
```

### 5. Routing & Navigation

Use **React Router v6**:

```typescript
// In App.tsx
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/library" element={<Library />} />
  <Route path="/user/:id" element={<UserProfile />} />
  <Route path="*" element={<NotFound />} />
</Routes>

// In components
const navigate = useNavigate();
navigate('/library');
```

### 6. Lazy Loading Routes

Heavy pages load only when accessed:

```typescript
const Suno = lazy(() => import("./pages/Suno"));

<Suspense fallback={<RouteFallback />}>
  <Route path="/suno" element={<Suno />} />
</Suspense>
```

### 7. Error Handling

- **Global**: `main.tsx` catches unhandled errors
- **Component-level**: `ErrorBoundary.tsx` catches render errors
- **Route-level**: `NotFound.tsx` for 404s

### 8. Naming Conventions

- **Files**: PascalCase for components, camelCase for utilities
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase with `T` prefix (optional)
- **Classes**: Not used (functional components only)

### 9. TypeScript Settings

The project uses **relaxed TypeScript** (`tsconfig.app.json`):
- `noImplicitAny: false` — `any` type is allowed
- `noUnusedLocals: false` — Unused variables don't error
- `strict: false` — Not in strict mode

**This is intentional** for development speed. Add explicit types when you can, but don't enforce strict typing everywhere.

### 10. Environment Variables

Create `.env.local` or use `.env` files:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=eyxxx
VITE_API_URL=https://api.example.com
```

Access in code:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

---

## Supabase Integration

### Database
- **URL**: https://bmwtydwpevzhbdplilbr.supabase.co
- **Library**: `@supabase/supabase-js`

### Authentication
- Supabase Auth (email/password + OAuth)
- Lovable Cloud Auth for web app

### Migrations
- Located in: `/supabase/migrations/`
- Manage via Supabase Dashboard or CLI

### Edge Functions
- Located in: `/supabase/functions/`
- Used for serverless endpoints (e.g., gift links: `/prezent/:id`)

### Key Files
- `/supabase/migrations/` — Schema definitions
- `/src/integrations/supabase/` — Client initialization

---

## Build Optimization

### Code Splitting Strategy

**Manual vendor chunks** (defined in `vite.config.ts`):

```typescript
manualChunks: {
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-supabase": ["@supabase/supabase-js"],
  "vendor-motion": ["framer-motion"],
  "vendor-charts": ["recharts", "chart.js", "react-chartjs-2"],
}
```

**Why**: Vendor code rarely changes, so browsers cache it across deploys. Only app code chunk updates.

### Heavy Libraries (Lazy-Loaded)

These only load when their routes are accessed:
- `face-api` — Facial recognition
- `tiptap` — Rich text editor
- `xlsx` — Excel export
- `jspdf` — PDF generation
- `wavesurfer` — Audio waveform

---

## Common Patterns

### 1. Protected Routes

```typescript
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}
```

### 2. Loading States

```typescript
import Skeleton from '@/components/ui/skeleton';

export function MyComponent() {
  const { data, isLoading } = useQuery(/* ... */);
  
  if (isLoading) return <Skeleton className="h-12 w-full" />;
  return <div>{data}</div>;
}
```

### 3. Toast Notifications

```typescript
import { useToast } from '@/components/ui/use-toast';

export function MyForm() {
  const { toast } = useToast();
  
  const handleSubmit = async (data) => {
    try {
      await api.post('/data', data);
      toast({ title: 'Success!', description: 'Data saved.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };
}
```

### 4. Modal Dialogs

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function MyModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Title</DialogTitle>
        </DialogHeader>
        {/* Content */}
      </DialogContent>
    </Dialog>
  );
}
```

---

## Performance Considerations

1. **Route-Level Code Splitting** — Lazy load all page components
2. **Vendor Chunking** — Keep dependencies in stable bundles
3. **Image Optimization** — Use WebP + lazy loading
4. **React Query Caching** — Avoid redundant API calls
5. **Memoization** — Use `useMemo`/`useCallback` for expensive computations
6. **Auto-Refresh** — App reloads after 25 min idle (see `main.tsx`)

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(<MyComponent />);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
npm run test          # Run once
npm run test:watch   # Watch mode
```

Config: `vitest.config.ts`

---

## Security Considerations

1. **Service Worker Disabled** — Old SW caused infinite reload loops
2. **SWC Transpiler** — Faster builds with `@vitejs/plugin-react-swc`
3. **HSTS + X-Content-Type-Options** — Security headers in `vercel.json`
4. **Secrets in GitHub** — Never commit `.env.local`; use GitHub Secrets for CI/CD
5. **Auth** — Leverage Supabase Auth, don't implement custom auth
6. **CORS** — Configured via Supabase + Vercel headers

---

## Lovable & Version Control

### Lovable Integration
- **Project ID**: `462bddcb-d545-4f42-bc51-5f437cb12bbe`
- **Env**: Production
- **Sync**: Bidirectional — Changes in Lovable auto-commit to Git, and vice versa

### Workflow
1. Edit in **Lovable UI** → Auto-commits to `main`
2. Edit locally → Push to `main` → Lovable syncs
3. Create PR → Lovable creates preview environment

### OAuth Redirect
- Lovable OAuth: `/~oauth/initiate` → Lovable's OAuth endpoint (see `vercel.json`)

---

## Troubleshooting

### Issue: Blank Page After Deploy
**Cause**: Old Service Worker reload loop (now fixed in `main.tsx`)
**Solution**: Clear site data, hard refresh (Cmd+Shift+R)

### Issue: Build Failing with TypeScript Errors
**Context**: `tsconfig.app.json` has `strict: false`
**Solution**: Errors are often warnings; check CI logs, may not block deploy

### Issue: API Requests Timing Out
**Check**: Supabase project status, API rate limits, network tab

### Issue: Styles Not Applying
**Check**: Tailwind config, CSS import order, class name typo

---

## Useful Commands

```bash
# Development
npm run dev             # Start local dev server
npm run test:watch     # Run tests in watch mode

# Building
npm run build          # Production build
npm run preview        # Preview production build

# Code Quality
npm run lint           # Check linting
npm run lint --fix     # Auto-fix linting issues

# Deployment
git push origin main   # Deploy to Lovable + Vercel
git push -u origin <branch>  # Deploy preview to branch
```

---

## Key Dependencies

### Core
- **react** — UI library
- **react-router-dom** — Client routing
- **react-hook-form** — Form handling
- **@tanstack/react-query** — Server state management
- **zod** — Schema validation

### UI/Styling
- **@radix-ui/** — Headless UI components
- **shadcn/ui** — React component library
- **tailwindcss** — Utility-first CSS
- **framer-motion** — Animation library
- **lucide-react** — Icons

### Media
- **@ffmpeg/ffmpeg** — Video processing
- **wavesurfer.js** — Audio waveform
- **@spotify/basic-pitch** — Music pitch detection
- **jspdf** — PDF generation
- **xlsx** — Excel export
- **react-chartjs-2** — Charts

### Backend
- **@supabase/supabase-js** — Database client

### Development
- **vite** — Build tool
- **typescript** — Type safety
- **vitest** — Test runner
- **eslint** — Linting

---

## Related Projects

- **groua-engine/** — Python backend (separate repo)
- **hub/** — Purpose TBD

---

## Contact & Support

- **Project Owner**: Greg (greg197512)
- **Email**: grzegorzkaron553@gmail.com
- **Lovable Project**: https://lovable.dev/projects/462bddcb-d545-4f42-bc51-5f437cb12bbe

---

## Last Updated

**2026-07-18** — Comprehensive documentation covering architecture, conventions, and development workflows for AI assistants.

