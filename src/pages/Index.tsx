import { MainLayout } from "@/components/layout/MainLayout";
import { HeroSection } from "@/components/sections/HeroSection";
import { AIDJSection } from "@/components/sections/AIDJSection";
import { RecentlyPlayed } from "@/components/sections/RecentlyPlayed";
import { PlaylistGrid } from "@/components/sections/PlaylistGrid";
import { LiveRadioCard } from "@/components/sections/LiveRadioCard";
import { TopArtists } from "@/components/sections/TopArtists";
import { GenreSection } from "@/components/sections/GenreSection";
import { NewOnServer } from "@/components/sections/NewOnServer";
import { AdminMarquee } from "@/components/sections/AdminMarquee";
import { UploadCTA } from "@/components/sections/UploadCTA";
import { SupportSection } from "@/components/sections/SupportSection";
import { PromotedTracksSection } from "@/components/sections/PromotedTracks";
import { SEOContentSection } from "@/components/sections/SEOContentSection";
import { BlogPromoButton } from "@/components/sections/BlogPromoButton";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { useLanguage } from "@/contexts/LanguageContext";

const Section = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <SectionErrorBoundary name={name}>{children}</SectionErrorBoundary>
);

const Index = () => {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <Section name="hero"><HeroSection /></Section>
      <Section name="upload-cta"><UploadCTA /></Section>
      <Section name="promoted"><PromotedTracksSection /></Section>
      <Section name="marquee"><AdminMarquee /></Section>
      <Section name="new-on-server"><NewOnServer /></Section>
      <Section name="recently-played"><RecentlyPlayed /></Section>

      <Section name="g-edm"><GenreSection genre="EDM" title={t("section.edm")} icon="headphones" color="text-primary" limit={8} /></Section>
      <Section name="g-disco"><GenreSection genre="Disco" title={t("section.disco")} icon="nightlife" color="text-accent" limit={8} /></Section>
      <Section name="g-house"><GenreSection genre="House" title={t("section.house")} icon="music_note" color="text-primary" limit={8} /></Section>
      <Section name="g-rock"><GenreSection genre="Rock" title={t("section.rock")} icon="electric_bolt" color="text-primary" limit={8} /></Section>
      <Section name="g-punk"><GenreSection genre="Punk" title={t("section.punk")} icon="whatshot" color="text-destructive" limit={8} /></Section>
      <Section name="g-pop"><GenreSection genre="Pop" title={t("section.pop")} icon="star" color="text-accent" limit={8} /></Section>
      <Section name="g-hiphop"><GenreSection genre="Hip-Hop" title={t("section.hiphop")} icon="mic" color="text-primary" limit={8} /></Section>
      <Section name="g-rnb"><GenreSection genre="R&B" title={t("section.rnb")} icon="favorite" color="text-accent" limit={8} /></Section>
      <Section name="g-trance"><GenreSection genre="Trance" title={t("section.trance")} icon="waves" color="text-primary" limit={8} /></Section>

      <Section name="live-radio"><LiveRadioCard /></Section>
      <Section name="ai-dj"><AIDJSection /></Section>
      <Section name="made-for-you"><PlaylistGrid title={t("section.madeForYou")} subtitle={t("section.madeForYouDesc")} /></Section>
      <Section name="top-artists"><TopArtists /></Section>
      <Section name="trending"><PlaylistGrid title={t("section.trendingNow")} subtitle={t("section.trendingNowDesc")} /></Section>
      <Section name="seo"><SEOContentSection /></Section>
      <Section name="support"><SupportSection /></Section>
    </MainLayout>
  );
};

export default Index;
