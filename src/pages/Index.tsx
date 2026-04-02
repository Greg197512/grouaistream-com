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
import { SupportSection } from "@/components/sections/SupportSection";
import { PromotedTracksSection } from "@/components/sections/PromotedTracks";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <HeroSection />
      <UploadCTA />
      <PromotedTracksSection />
      <NewOnServer />
      <RecentlyPlayed />
      
      <GenreSection genre="EDM" title={t("section.edm")} icon="headphones" color="text-primary" limit={8} />
      <GenreSection genre="Disco" title={t("section.disco")} icon="nightlife" color="text-accent" limit={8} />
      <GenreSection genre="House" title={t("section.house")} icon="music_note" color="text-primary" limit={8} />
      <GenreSection genre="Rock" title={t("section.rock")} icon="electric_bolt" color="text-primary" limit={8} />
      <GenreSection genre="Punk" title={t("section.punk")} icon="whatshot" color="text-destructive" limit={8} />
      <GenreSection genre="Pop" title={t("section.pop")} icon="star" color="text-accent" limit={8} />
      <GenreSection genre="Hip-Hop" title={t("section.hiphop")} icon="mic" color="text-primary" limit={8} />
      <GenreSection genre="R&B" title={t("section.rnb")} icon="favorite" color="text-accent" limit={8} />
      <GenreSection genre="Trance" title={t("section.trance")} icon="waves" color="text-primary" limit={8} />
      
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
      <SupportSection />
    </MainLayout>
  );
};

export default Index;
