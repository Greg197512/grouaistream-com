import { motion } from "framer-motion";
import { Radio as RadioIcon, Wifi, ExternalLink, Headphones } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

const PLAYER_URL = "https://play.radioking.io/grouarock-radio1";

const Radio = () => {
  return (
    <MainLayout>
      <div className="px-6 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        {/* Compact Radio Widget */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="groove-gradient-bg h-12 w-12 rounded-full flex items-center justify-center shadow-lg"
              style={{ boxShadow: "var(--groove-glow)" }}
            >
              <RadioIcon className="h-6 w-6 text-primary-foreground" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold">GrouaRadio</h2>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold animate-pulse">
                  <Wifi className="h-2.5 w-2.5" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-muted-foreground">GrouaRock Radio</p>
            </div>
          </div>

          {/* Mini Player iframe */}
          <div className="rounded-2xl overflow-hidden border border-border/50 bg-card" style={{ boxShadow: "0 0 30px hsl(14 100% 57% / 0.06)" }}>
            <div className="h-1 w-full groove-gradient-bg" />
            <iframe
              src={PLAYER_URL}
              className="w-full border-0"
              style={{ height: "160px" }}
              allow="autoplay; encrypted-media"
              title="GrouaRadio Player"
            />
          </div>

          {/* Open in new tab */}
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => window.open(PLAYER_URL, "_blank")}
              variant="ghost"
              size="sm"
              className="gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Otwórz pełny player
            </Button>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Radio;
