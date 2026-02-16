import { motion } from "framer-motion";
import { Radio as RadioIcon, Wifi, ExternalLink, Sparkles, Headphones } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

const PLAYER_URL = "https://play.radioking.io/grouarock-radio1";

const Radio = () => {
  return (
    <MainLayout>
      <div className="px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="groove-gradient-bg h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ boxShadow: "var(--groove-glow)" }}
          >
            <RadioIcon className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold">GrouaRadio Live</h1>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/20 text-destructive text-xs font-semibold animate-pulse">
                <Wifi className="h-3 w-3" />
                LIVE
              </span>
            </div>
            <p className="text-muted-foreground mt-1">
              AI-enhanced radio streaming • Powered by GrouaRock Radio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-xs text-accent font-medium">AI Enhanced</span>
            </div>
            <Button
              onClick={() => window.open(PLAYER_URL, "_blank")}
              variant="outline"
              className="gap-2 hover:bg-primary/10"
            >
              <ExternalLink className="h-4 w-4" />
              Nowa karta
            </Button>
          </div>
        </div>

        {/* Player Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden border border-border/50"
          style={{ boxShadow: "0 0 40px hsl(14 100% 57% / 0.08), 0 0 80px hsl(38 100% 50% / 0.05)" }}
        >
          {/* Decorative top bar */}
          <div className="relative h-2 w-full groove-gradient-bg">
            <motion.div
              className="absolute inset-0 opacity-50"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              style={{
                background: "linear-gradient(90deg, transparent, hsl(38 100% 50% / 0.6), transparent)",
                backgroundSize: "200% 100%",
              }}
            />
          </div>

          {/* Info bar above iframe */}
          <div className="flex items-center justify-between px-5 py-3 bg-card/80 backdrop-blur-sm border-b border-border/30">
            <div className="flex items-center gap-3">
              <Headphones className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">GrouaRock Radio Player</span>
              <div className="flex gap-1 ml-2">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-primary rounded-full"
                    animate={{ height: [4, 12, 4] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">play.radioking.io</span>
          </div>

          {/* Iframe */}
          <div className="bg-card">
            <iframe
              src={PLAYER_URL}
              className="w-full border-0"
              style={{ height: "calc(100vh - 300px)", minHeight: "480px" }}
              allow="autoplay; encrypted-media"
              title="GrouaRadio Player"
            />
          </div>

          {/* Decorative bottom bar */}
          <div className="h-1 w-full groove-gradient-bg opacity-50" />
        </motion.div>

        {/* Bottom hint */}
        <p className="text-center text-xs text-muted-foreground">
          Naciśnij Play w playerze powyżej, aby rozpocząć słuchanie • Używaj kontrolek głośności w playerze
        </p>
      </div>
    </MainLayout>
  );
};

export default Radio;
