import { MainLayout } from "@/components/layout/MainLayout";
import { GameStrip } from "@/components/game/GameStrip";
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

import SectionErrorBoundary from "@/components/SectionErrorBoundary";
      <GameBadge />
      <Section name="hero"><HeroSection /></Section>
      <Section name="win-game"><div className="px-4 max-w-6xl mx-auto"><GameStrip /></div></Section>
      <Section name="upload-cta"><UploadCTA /></Section>
      <Section name="promoted"><PromotedTracksSection /></Section>
      <Section name="marquee"><AdminMarquee /></Section>
      <Section name="new-on-server"><NewOnServer /></Section>
      <Section name="recently-played"><RecentlyPlayed /></Section>

      <Section name="g-pop"><GenreSection genre="Pop" title={t("section.pop")} icon="star" color="text-accent" limit={12} /></Section>
      <Section name="g-rock"><GenreSection genre="Rock" title={t("section.rock")} icon="electric_bolt" color="text-primary" limit={12} /></Section>
      <Section name="g-hiphop"><GenreSection genre="Hip-Hop" title={t("section.hiphop")} icon="mic" color="text-primary" limit={12} /></Section>
      <Section name="g-electronic"><GenreSection genre="Electronic" title="Electronic" icon="graphic_eq" color="text-primary" limit={12} /></Section>
      <Section name="g-folk"><GenreSection genre="Folk" title="Folk" icon="forest" color="text-accent" limit={8} /></Section>
      <Section name="g-edm"><GenreSection genre="EDM" title={t("section.edm")} icon="headphones" color="text-primary" limit={8} /></Section>
      <Section name="g-country"><GenreSection genre="Country" title="Country" icon="agriculture" color="text-accent" limit={8} /></Section>
      <Section name="g-rnb"><GenreSection genre="R&B" title={t("section.rnb")} icon="favorite" color="text-accent" limit={8} /></Section>
      <Section name="g-disco"><GenreSection genre="Disco" title={t("section.disco")} icon="nightlife" color="text-accent" limit={8} /></Section>
      <Section name="g-other"><GenreSection genre="Other" title="Inne odkrycia" icon="explore" color="text-primary" limit={12} /></Section>

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
