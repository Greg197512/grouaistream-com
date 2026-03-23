import { motion } from "framer-motion";
import { Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const UploadCTA = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/10 via-green-500/5 to-primary/10 p-8 md:p-10"
      >
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-green-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-500/15 border border-green-500/25 px-3 py-1 text-xs font-medium text-green-400 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              {t("upload.ctaBadge")}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {t("upload.ctaTitle")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">
              {t("upload.ctaDesc").split("{ai}").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="text-primary font-medium">AI-Assisted</span>}
                </span>
              ))}
            </p>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              onClick={() => navigate("/upload")}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold rounded-full px-8 h-13 gap-2 text-base shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.5)] transition-shadow"
            >
              <Upload className="h-5 w-5" />
              {t("upload.ctaButton")}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
