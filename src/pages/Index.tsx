import { MainLayout } from "@/components/layout/MainLayout";
import { HeroSection } from "@/components/sections/HeroSection";
import { AIDJSection } from "@/components/sections/AIDJSection";
import { RecentlyPlayed } from "@/components/sections/RecentlyPlayed";
import { PlaylistGrid } from "@/components/sections/PlaylistGrid";
import { LiveRadioCard } from "@/components/sections/LiveRadioCard";
import { TopArtists } from "@/components/sections/TopArtists";
import { GenreSection } from "@/components/sections/GenreSection";
import { NewOnServer } from "@/components/sections/NewOnServer";
import { UploadCTA } from "@/components/sections/UploadCTA";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <HeroSection />
      <NewOnServer />
      <RecentlyPlayed />
      
      <GenreSection genre="EDM" title="🎧 EDM & Electronic Hits" icon="headphones" color="text-primary" limit={8} />
      <GenreSection genre="Disco" title="🪩 Disco Classics & Grooves" icon="nightlife" color="text-accent" limit={8} />
      <GenreSection genre="House" title="🏠 House Music Essentials" icon="music_note" color="text-primary" limit={8} />
      <GenreSection genre="Rock" title="🎸 Rock Hits 2026" icon="electric_bolt" color="text-primary" limit={8} />
      <GenreSection genre="Punk" title="🤘 Punk & Punk-Rock" icon="whatshot" color="text-destructive" limit={8} />
      <GenreSection genre="Pop" title="🎤 Pop Favorites" icon="star" color="text-accent" limit={8} />
      <GenreSection genre="Hip-Hop" title="🎤 Hip-Hop & Rap" icon="mic" color="text-primary" limit={8} />
      <GenreSection genre="R&B" title="💜 R&B & Soul" icon="favorite" color="text-accent" limit={8} />
      <GenreSection genre="Trance" title="🌌 Trance & Progressive" icon="waves" color="text-primary" limit={8} />
      
      <LiveRadioCard />
      <AIDJSection />
      <PlaylistGrid 
        title={t("section.madeForYou")} 
        subtitle={t("section.madeForYouDesc")}
      />
      <TopArtists />
      <PlaylistGrid 
        title={t("section.trendingNow")} 
        subtitle={t("section.trendingNowDesc")}
      />
    </MainLayout>
  );
};

export default Index;
