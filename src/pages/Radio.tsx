import { motion } from "framer-motion";
import { Radio as RadioIcon, Wifi, ExternalLink, Sparkles } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

const PLAYER_URL = "https://play.radioking.io/grouarock-radio1";

const Radio = () => {
  return (
    <MainLayout>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="groove-gradient-bg h-16 w-16 rounded-2xl flex items-center justify-center"
          >
            <RadioIcon className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-3xl font-bold">GrouaRadio Live</h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-medium animate-pulse">
                <Wifi className="h-3 w-3" />
                LIVE
              </span>
            </div>
            <p className="text-muted-foreground">
              AI-enhanced radio streaming • Powered by GrouaRock Radio
            </p>
          </div>
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
            Otwórz w nowej karcie
          </Button>
        </div>

        {/* Embedded Player */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="groove-card overflow-hidden rounded-2xl"
        >
          <iframe
            src={PLAYER_URL}
            className="w-full border-0"
            style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
            allow="autoplay; encrypted-media"
            title="GrouaRadio Player"
          />
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Radio;
