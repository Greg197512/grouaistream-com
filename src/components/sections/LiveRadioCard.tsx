import { motion } from "framer-motion";
import { Radio, Sparkles, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { homeTxt } from "@/lib/homeI18n";

export const LiveRadioCard = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = homeTxt(language);
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
        
        {/* Content */}
        <div className="relative flex items-center justify-between p-6 md:p-8">
          <div className="flex items-center gap-4">
            <motion.div 
              
              className="flex h-16 w-16 items-center justify-center rounded-2xl groove-gradient-bg shadow-lg"
            >
              <Radio className="h-8 w-8 text-primary-foreground" />
            </motion.div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-xl font-bold">{t.radioTitle}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                  <Wifi className="h-3 w-3" />
                  LIVE
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.radioDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-xs text-accent font-medium">Nova AI</span>
            </div>
            <Button 
              onClick={() => navigate("/radio-live")}
              className="groove-gradient-bg hover:opacity-90 gap-2 rounded-full"
            >
              <Radio className="h-4 w-4" />
              {t.tuneIn}
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
