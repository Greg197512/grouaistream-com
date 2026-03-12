import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WelcomeConfetti } from "@/components/effects/WelcomeConfetti";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AIProvider } from "@/contexts/AIContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UnlockProvider } from "@/contexts/UnlockContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AutoVoiceListener } from "@/components/player/AutoVoiceListener";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";
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
import Movies from "./pages/Movies";
import Server from "./pages/Server";
import Legal from "./pages/Legal";
import PartyPulpit from "./pages/PartyPulpit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const WelcomeOverlay = () => {
  const { isFirstLogin, clearFirstLogin } = useAuth();
  return <WelcomeConfetti show={isFirstLogin} onComplete={clearFirstLogin} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
    <UnlockProvider>
    <AuthProvider>
      <SubscriptionProvider>
      <PlayerProvider>
        <AIProvider>
          <TooltipProvider>
            <div className="dark">
              <Toaster />
              <Sonner />
              <WelcomeOverlay />
              <PWAInstallPrompt />
              <BrowserRouter>
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
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/party/:code" element={<PartyPulpit />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </div>
          </TooltipProvider>
        </AIProvider>
      </PlayerProvider>
      </SubscriptionProvider>
    </AuthProvider>
    </UnlockProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
