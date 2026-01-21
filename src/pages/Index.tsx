import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { HeroSection } from "@/components/sections/HeroSection";
import { AIDJSection } from "@/components/sections/AIDJSection";
import { RecentlyPlayed } from "@/components/sections/RecentlyPlayed";
import { PlaylistGrid } from "@/components/sections/PlaylistGrid";
import { LiveRadioCard } from "@/components/sections/LiveRadioCard";
import { TopArtists } from "@/components/sections/TopArtists";
import { GenreSection } from "@/components/sections/GenreSection";
import { VideoPlayer } from "@/components/player/VideoPlayer";

declare global {
  interface Window {
    toggleVideoPlayer?: () => void;
  }
}

const Index = () => {
  const [showVideoPlayer, setShowVideoPlayer] = useState(true);

  // Expose toggle function globally for PlayerBar to access
  useEffect(() => {
    window.toggleVideoPlayer = () => {
      setShowVideoPlayer(prev => !prev);
    };
    return () => {
      window.toggleVideoPlayer = undefined;
    };
  }, []);

  return (
    <MainLayout>
      <HeroSection />
      <RecentlyPlayed />
      
      {/* Genre Sections */}
      <GenreSection 
        genre="Rock" 
        title="🎸 Rock Hits 2026" 
        icon="electric_bolt"
        color="text-primary"
        limit={8}
      />
      
      <GenreSection 
        genre="Punk" 
        title="🤘 Punk & Punk-Rock" 
        icon="whatshot"
        color="text-destructive"
        limit={8}
      />
      
      <GenreSection 
        genre="Pop" 
        title="🎤 Pop Favorites" 
        icon="star"
        color="text-accent"
        limit={8}
      />
      
      <LiveRadioCard />
      <AIDJSection />
      <PlaylistGrid 
        title="Made For You by AI" 
        subtitle="Playlists curated based on your mood and listening patterns"
      />
      <TopArtists />
      <PlaylistGrid 
        title="Trending Now" 
        subtitle="What the world is listening to"
      />

      {/* Video Player (floating) */}
      <VideoPlayer
        isVisible={showVideoPlayer}
        onClose={() => setShowVideoPlayer(false)}
      />
    </MainLayout>
  );
};

export default Index;
