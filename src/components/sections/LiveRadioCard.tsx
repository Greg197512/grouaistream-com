import { motion } from "framer-motion";
import { Radio, Sparkles, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const LiveRadioCard = () => {
  const navigate = useNavigate();
  return (
    <section className="px-6 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl"
      >
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/bg/radio.jpg')", opacity: 0.55 }} />
        <div className="absolute inset-0 groove-gradient-bg opacity-15" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/70" />
        
        {/* Animated waves */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-primary/20"
              initial={{ scale: 1, opacity: 0.3 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                delay: i * 1,
                ease: "easeOut"
              }}
              style={{ 
                left: "10%",
                top: "50%",
                width: "100px",
                height: "100px",
                transform: "translate(-50%, -50%)"
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative flex items-center justify-between p-6 md:p-8">
          <div className="flex items-center gap-4">
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl groove-gradient-bg shadow-lg"
            >
              <Radio className="h-8 w-8 text-primary-foreground" />
            </motion.div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-xl font-bold">GrouaRadio Live</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                  <Wifi className="h-3 w-3" />
                  LIVE
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                24/7 AI-curated radio from grouaradio.com • 1,247 listeners
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-xs text-accent font-medium">AI Enhanced</span>
            </div>
            <Button 
              onClick={() => navigate("/radio-live")}
              className="groove-gradient-bg hover:opacity-90 gap-2 rounded-full"
            >
              <Radio className="h-4 w-4" />
              Tune In
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
