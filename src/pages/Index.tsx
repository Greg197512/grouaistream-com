import { MainLayout } from "@/components/layout/MainLayout";
import { HeroSection } from "@/components/sections/HeroSection";
import { AIDJSection } from "@/components/sections/AIDJSection";
import { RecentlyPlayed } from "@/components/sections/RecentlyPlayed";
import { PlaylistGrid } from "@/components/sections/PlaylistGrid";
import { LiveRadioCard } from "@/components/sections/LiveRadioCard";
import { TopArtists } from "@/components/sections/TopArtists";

const Index = () => {
  return (
    <MainLayout>
      <HeroSection />
      <RecentlyPlayed />
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
    </MainLayout>
  );
};

export default Index;
