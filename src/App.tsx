import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WelcomeConfetti } from "@/components/effects/WelcomeConfetti";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AIProvider } from "@/contexts/AIContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AutoVoiceListener } from "@/components/player/AutoVoiceListener";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
import { TipWelcomeModal } from "@/components/modals/TipWelcomeModal";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CheckoutSuccessHandler } from "@/components/CheckoutSuccessHandler";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Route-level code-splitting: każda strona ładuje się dopiero przy wejściu,
// dzięki czemu główny bundle nie zawiera ciężkich bibliotek (face-api,
// tiptap, xlsx, wavesurfer, jspdf) używanych tylko w panelach.
const Search = lazy(() => import("./pages/Search"));
const Library = lazy(() => import("./pages/Library"));
const LikedSongs = lazy(() => import("./pages/LikedSongs"));
const CreatePlaylist = lazy(() => import("./pages/CreatePlaylist"));
const Radio = lazy(() => import("./pages/Radio"));
const RadioLive = lazy(() => import("./pages/RadioLive"));
const RadioEmbed = lazy(() => import("./pages/RadioEmbed"));
const ImportYouTube = lazy(() => import("./pages/ImportYouTube"));
const Settings = lazy(() => import("./pages/Settings"));
const PlaylistManager = lazy(() => import("./pages/PlaylistManager"));
const PlaylistDetail = lazy(() => import("./pages/PlaylistDetail"));
const MoodHistory = lazy(() => import("./pages/MoodHistory"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminBrain = lazy(() => import("./pages/AdminBrain"));
const AdminAurora = lazy(() => import("./pages/AdminAurora"));
const AdminSEO = lazy(() => import("./pages/AdminSEO"));
const Movies = lazy(() => import("./pages/Movies"));
const Server = lazy(() => import("./pages/Server"));
const Legal = lazy(() => import("./pages/Legal"));
const PartyPulpit = lazy(() => import("./pages/PartyPulpit"));
const Suno = lazy(() => import("./pages/Suno"));
const LocalPlayer = lazy(() => import("./pages/LocalPlayer"));
const Upload = lazy(() => import("./pages/Upload"));
const MyTracks = lazy(() => import("./pages/MyTracks"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const AlbumCreator = lazy(() => import("./pages/AlbumCreator"));
const CreatorEarnings = lazy(() => import("./pages/CreatorEarnings"));
const EarnWithUs = lazy(() => import("./pages/EarnWithUs"));
const BlogIndex = lazy(() => import("./pages/BlogIndex"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const AdSubmission = lazy(() => import("./pages/AdSubmission"));
const Orders = lazy(() => import("./pages/Orders"));
const NicheLandingPage = lazy(() => import("./pages/NicheLandingPage"));
const Sponsor = lazy(() => import("./pages/Sponsor"));
const Business = lazy(() => import("./pages/Business"));
const ArtistLanding = lazy(() => import("./pages/ArtistLanding"));
const ClientDashboard = lazy(() => import("./pages/ClientDashboard"));
const Binaural = lazy(() => import("./pages/Binaural"));

// Empire Platform pages
const EmpireDashboard = lazy(() => import("./pages/empire/EmpireDashboard"));
const EmpireProjects = lazy(() => import("./pages/empire/EmpireProjects"));
const KnowledgeGarden = lazy(() => import("./pages/empire/KnowledgeGarden"));
const EmpireAnalytics = lazy(() => import("./pages/empire/EmpireAnalytics"));
const AgentBuilder = lazy(() => import("./pages/empire/AgentBuilder"));
const AgentMarketplace = lazy(() => import("./pages/empire/AgentMarketplace"));
const EmpireCommunity = lazy(() => import("./pages/empire/EmpireCommunity"));
const ApifyResearch = lazy(() => import("./pages/empire/ApifyResearch"));

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center gap-3">
    <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    <span className="text-sm text-muted-foreground">Ładowanie…</span>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 min — avoid refetching too often
      gcTime: 10 * 60 * 1000,      // 10 min — garbage-collect old cache entries
      retry: 1,                     // only 1 retry to avoid memory pressure
      refetchOnWindowFocus: false,  // don't refetch on tab switch
    },
  },
});

const WelcomeOverlay = () => {
  const { isFirstLogin, clearFirstLogin } = useAuth();
  return <WelcomeConfetti show={isFirstLogin} onComplete={clearFirstLogin} />;
};

const AppShell = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <span className="text-sm text-muted-foreground">Przywracanie sesji…</span>
      </div>
    );
  }

  return (
    <>
      <PaymentTestModeBanner />
      <WelcomeOverlay />
      <TipWelcomeModal />
      <PWAInstallPrompt />
      <BrowserRouter>
        <CheckoutSuccessHandler />
        <AutoVoiceListener />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/search" element={<Search />} />
          <Route path="/library" element={<Library />} />
          <Route path="/liked" element={<LikedSongs />} />
          <Route path="/create-playlist" element={<CreatePlaylist />} />
          <Route path="/radio" element={<Radio />} />
          <Route path="/radio-live" element={<RadioLive />} />
          <Route path="/radio-live/embed" element={<RadioEmbed />} />
          <Route path="/import-youtube" element={<ImportYouTube />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/playlist-manager" element={<PlaylistManager />} />
          {/* Alias: stare linki /playlists (m.in. z menu mobilnego) też trafiają do menedżera */}
          <Route path="/playlists" element={<PlaylistManager />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/mood-history" element={<MoodHistory />} />
          <Route path="/ai-dj" element={<Index />} />
          <Route path="/mood" element={<MoodHistory />} />
          <Route path="/daily-mix" element={<Index />} />
          <Route path="/social" element={<Index />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/server" element={<Server />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/brain" element={<AdminBrain />} />
          <Route path="/admin/aurora" element={<AdminAurora />} />
          <Route path="/admin/seo" element={<AdminSEO />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/party/:code" element={<PartyPulpit />} />
          <Route path="/suno" element={<Suno />} />
          <Route path="/studio" element={<Suno />} />
          <Route path="/local-player" element={<LocalPlayer />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/my-tracks" element={<MyTracks />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/album-creator" element={<AlbumCreator />} />
          <Route path="/earnings" element={<CreatorEarnings />} />
          <Route path="/earn" element={<EarnWithUs />} />
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/reklama/:token" element={<AdSubmission />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/n/:slug" element={<NicheLandingPage />} />
          <Route path="/sponsor" element={<Sponsor />} />
          <Route path="/business" element={<Business />} />
          <Route path="/dla-firm" element={<Business />} />
          <Route path="/artysta" element={<ArtistLanding />} />
          <Route path="/artist" element={<ArtistLanding />} />
          <Route path="/client-dashboard" element={<ClientDashboard />} />
          <Route path="/client-dashboard/:orderId" element={<ClientDashboard />} />
          <Route path="/binaural" element={<Binaural />} />
          <Route path="/empire" element={<EmpireDashboard />} />
          <Route path="/empire/projects" element={<EmpireProjects />} />
          <Route path="/empire/knowledge" element={<KnowledgeGarden />} />
          <Route path="/empire/analytics" element={<EmpireAnalytics />} />
          <Route path="/empire/agent-builder" element={<AgentBuilder />} />
          <Route path="/empire/marketplace" element={<AgentMarketplace />} />
          <Route path="/empire/community" element={<EmpireCommunity />} />
          <Route path="/empire/research" element={<ApifyResearch />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <AuthProvider>
        <SubscriptionProvider>
        <PlayerProvider>
          <AIProvider>
            <TooltipProvider>
              <div className="dark">
                <Toaster />
                <Sonner />
                <AppShell />
              </div>
            </TooltipProvider>
          </AIProvider>
        </PlayerProvider>
        </SubscriptionProvider>
      </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
