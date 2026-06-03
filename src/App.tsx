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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Search from "./pages/Search";
import Library from "./pages/Library";
import LikedSongs from "./pages/LikedSongs";
import CreatePlaylist from "./pages/CreatePlaylist";
import Radio from "./pages/Radio";
import RadioLive from "./pages/RadioLive";
import RadioEmbed from "./pages/RadioEmbed";
import ImportYouTube from "./pages/ImportYouTube";
import Settings from "./pages/Settings";
import PlaylistManager from "./pages/PlaylistManager";
import PlaylistDetail from "./pages/PlaylistDetail";
import MoodHistory from "./pages/MoodHistory";
import Admin from "./pages/Admin";
import AdminBrain from "./pages/AdminBrain";
import AdminAurora from "./pages/AdminAurora";
import AdminSEO from "./pages/AdminSEO";
import Movies from "./pages/Movies";
import Server from "./pages/Server";
import Legal from "./pages/Legal";
import PartyPulpit from "./pages/PartyPulpit";
import Suno from "./pages/Suno";
import LocalPlayer from "./pages/LocalPlayer";
import Upload from "./pages/Upload";
import MyTracks from "./pages/MyTracks";
import Unsubscribe from "./pages/Unsubscribe";
import AlbumCreator from "./pages/AlbumCreator";
import CreatorEarnings from "./pages/CreatorEarnings";
import EarnWithUs from "./pages/EarnWithUs";
import BlogIndex from "./pages/BlogIndex";
import BlogPost from "./pages/BlogPost";
import AdSubmission from "./pages/AdSubmission";
import Orders from "./pages/Orders";
import NicheLandingPage from "./pages/NicheLandingPage";
import Sponsor from "./pages/Sponsor";
import Business from "./pages/Business";
import ClientDashboard from "./pages/ClientDashboard";
import NotFound from "./pages/NotFound";
import Binaural from "./pages/Binaural";

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
          <Route path="/client-dashboard" element={<ClientDashboard />} />
          <Route path="/client-dashboard/:orderId" element={<ClientDashboard />} />
          <Route path="/binaural" element={<Binaural />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
