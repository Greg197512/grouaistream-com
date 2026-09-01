import { useEffect } from "react";
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
import { EraEntry } from "@/components/sections/EraEntry";
import { HomeGreeting } from "@/components/sections/HomeGreeting";
import { NaCzasieHits } from "@/components/sections/NaCzasieHits";

import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";

const Section = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <SectionErrorBoundary name={name}>{children}</SectionErrorBoundary>
);

/**
 * Odtwarza utwór ze współdzielonego linku (np. z ShareTrackModal:
 * grouaistream.com/?play=TRACK_ID) i sprząta URL, żeby odświeżenie
 * strony nie uruchamiało utworu ponownie.
 */
const useSharedTrackAutoplay = () => {
  const { playTrack } = usePlayer();

  useEffect(() => {
    const trackId = new URLSearchParams(window.location.search).get("play");
    if (!trackId) return;

    window.history.replaceState({}, "", window.location.pathname);

    supabase
      .from("tracks")
      .select("*")
      .eq("id", trackId)
      .maybeSingle()
      .then(({ data: track }) => {
        if (!track) return;
        playTrack({
          id: track.id, title: track.title, artist: track.artist,
          album: track.album || undefined, duration: track.duration,
          cover_url: track.cover_url || undefined, audio_url: track.audio_url || undefined,
          video_url: track.video_url || undefined, genre: track.genre || undefined,
          mood: track.mood || undefined,
        }, "shared-link");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const Index = () => {
  const { t } = useLanguage();
  useSharedTrackAutoplay();

  return (
    <MainLayout>
      <Section name="greeting"><HomeGreeting /></Section>
      <Section name="hero"><HeroSection /></Section>
      <Section name="na-czasie"><NaCzasieHits /></Section>
      <Section name="groua-era"><EraEntry /></Section>
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
