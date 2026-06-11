import { useState, useEffect, ReactNode, lazy, Suspense } from "react";
import { Sidebar } from "./Sidebar";
import { PlayerBar } from "./PlayerBar";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
// Lazy: asystent i video player nie blokują pierwszego renderu,
// a ciągną ciężkie zależności (react-markdown, wavesurfer).
const AIAssistant = lazy(() =>
  import("@/components/assistant/AIAssistant").then((m) => ({ default: m.AIAssistant }))
);
const InfinityAssistantWidget = lazy(() =>
  import("@/components/assistant/InfinityAssistantWidget").then((m) => ({ default: m.InfinityAssistantWidget }))
);
const VideoPlayer = lazy(() =>
  import("@/components/player/VideoPlayer").then((m) => ({ default: m.VideoPlayer }))
);
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlayer } from "@/contexts/PlayerContext";

import { DragDropProvider } from "@/contexts/DragDropContext";
import { FloatingPlaylistDropZones } from "@/components/dnd/FloatingPlaylistDropZones";
import { AuroraBackground } from "@/components/effects/AuroraBackground";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const isMobile = useIsMobile();
  const { isVideoMode, currentTrack } = usePlayer();
  const { upgradePromptFeature, dismissUpgradePrompt } = useSubscription();

  // Auto-show video player when a video track starts playing
  useEffect(() => {
    if (isVideoMode && currentTrack) {
      setShowVideo(true);
    }
  }, [isVideoMode, currentTrack]);

  // Expose toggle for PlayerBar button
  useEffect(() => {
    window.toggleVideoPlayer = () => setShowVideo(prev => !prev);
    return () => { delete window.toggleVideoPlayer; };
  }, []);

  return (
    <DragDropProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background relative">
        {/* Aurora animated background */}
        <AuroraBackground />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Sidebar - hidden on mobile */}
          {!isMobile && (
            <Sidebar 
              collapsed={sidebarCollapsed} 
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
            />
          )}

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar />
            <main className={`flex-1 overflow-y-auto groove-scrollbar ${isMobile ? 'pb-40' : 'pb-28'}`}>
              {children}
            </main>
          </div>
        </div>

        {/* Floating Playlist Drop Zones */}
        <FloatingPlaylistDropZones />

        {/* Floating Video Player */}
        <Suspense fallback={null}>
          <VideoPlayer isVisible={showVideo} onClose={() => setShowVideo(false)} />
        </Suspense>

        {/* Floating Draggable Player Bar */}
        <PlayerBar />

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNav />}

        {/* AI Assistant Chat + Infinity Widget */}
        <Suspense fallback={null}>
          <AIAssistant />
          <InfinityAssistantWidget />
        </Suspense>

        {/* Global UpgradeModal — opened by showUpgradeFor() from anywhere in the app */}
        <UpgradeModal
          open={upgradePromptFeature !== null}
          onOpenChange={(open) => { if (!open) dismissUpgradePrompt(); }}
        />
      </div>
    </DragDropProvider>
  );
};
