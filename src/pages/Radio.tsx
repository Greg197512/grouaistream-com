import { motion } from "framer-motion";
import { Radio as RadioIcon, Wifi, ExternalLink } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { BuyCoffeeButton } from "@/components/payments/BuyCoffeeButton";
import { ListenEverywhere } from "@/components/radio/ListenEverywhere";

const PLAYER_URL = "https://play.radioking.io/grouarock-radio1";

const Radio = () => {
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="px-6 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }} className="groove-gradient-bg h-12 w-12 rounded-full flex items-center justify-center shadow-lg" style={{ boxShadow: "var(--groove-glow)" }}>
              <RadioIcon className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">GrouaRadio</h2>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold animate-pulse">
                  <Wifi className="h-2.5 w-2.5" /> LIVE
                </span>
              </div>
              <p className="text-xs text-muted-foreground">GrouaRock Radio</p>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ boxShadow: "0 0 30px hsl(14 100% 57% / 0.06)" }}>
            <div className="h-1 w-full groove-gradient-bg" />
            <iframe src={PLAYER_URL} className="w-full border-0" style={{ height: "160px" }} allow="autoplay; encrypted-media" title="GrouaRadio Player" />
          </div>

          <div className="flex justify-center mt-4 gap-3 flex-wrap">
            <Button onClick={() => window.open(PLAYER_URL, "_blank")} variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3 w-3" />
              {t("radio.openFullPlayer")}
            </Button>
            <BuyCoffeeButton
              variant="outline"
              size="sm"
              className="text-xs border-primary/40 text-primary hover:bg-primary/10"
              label="Postaw nam kawę ☕"
            />
          </div>

          {/* Słuchaj wszędzie — w aucie, na telefonie, w aplikacjach radiowych */}
          <ListenEverywhere />

          {/* Mini coffee CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-amber-500/5 p-4 text-center"
          >
            <div className="text-2xl mb-1">☕</div>
            <p className="text-xs text-muted-foreground mb-2">
              Lubisz GrouaRadio? Postaw nam kawę i graj dalej.
            </p>
            <BuyCoffeeButton
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-primary to-amber-500 text-primary-foreground"
              label="Wspomagaj projekt"
            />
          </motion.div>

          {/* SEO crawlable links */}
          <nav className="flex flex-wrap justify-center gap-3 mt-6 text-xs" aria-label="Radio navigation">
            <Link to="/" className="text-primary hover:text-primary/80 underline underline-offset-4">Home</Link>
            <Link to="/radio-live" className="text-primary hover:text-primary/80 underline underline-offset-4">GrouaRadio Live</Link>
            <Link to="/upload" className="text-primary hover:text-primary/80 underline underline-offset-4">Upload Music</Link>
            <Link to="/suno" className="text-primary hover:text-primary/80 underline underline-offset-4">AI Music Studio</Link>
            <Link to="/search" className="text-primary hover:text-primary/80 underline underline-offset-4">Search</Link>
            <Link to="/earn" className="text-primary hover:text-primary/80 underline underline-offset-4">Earn With Us</Link>
          </nav>

          {/* SEO text for crawlers */}
          <div className="mt-8 text-xs text-muted-foreground/50 text-center max-w-sm leading-relaxed">
            <p>
              GrouaRadio is a 24/7 live radio station by GrouAI Stream. Featuring AI-curated music across EDM, Rock, Pop, 
              Hip-Hop, Trance, House, and more. Join the live chat, vote for your favorite tracks, and discover new music 
              through our community-driven radio experience. No bots, verified human streams only.
            </p>
          </div>
        </motion.div>

        {/* JSON-LD RadioStation for this page */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "RadioStation",
              name: "GrouaRadio",
              url: "https://grouaistream.com/radio",
              description: "GrouaRock Radio – 24/7 live radio station with community chat, real-time likes, and AI-curated programming. Part of GrouAI Stream platform.",
              broadcastDisplayName: "GrouaRadio Live",
              broadcastTimezone: "Europe/Warsaw",
              parentOrganization: {
                "@type": "Organization",
                name: "GrouAI",
                url: "https://grouaistream.com",
              },
              areaServed: { "@type": "Place", name: "Worldwide" },
            }),
          }}
        />
      </div>
    </MainLayout>
  );
};

export default Radio;