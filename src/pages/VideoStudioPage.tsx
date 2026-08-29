import { MainLayout } from "@/components/layout/MainLayout";
import { VideoStudio } from "@/components/studio/VideoStudio";
import { motion } from "framer-motion";
import { Film } from "lucide-react";

/**
 * Strona „Wideo" — tworzenie wideo dla WSZYSTKICH użytkowników.
 * Osobny adres (/video, /wideo) + wpis w nawigacji, żeby każdy łatwo trafił,
 * a nie tylko przez zakładkę w GrouAI Studio. Wybór formatu (pion/poziom/kwadrat)
 * jest dla każdego; jakość VIP wymaga planu Pro.
 */
const VideoStudioPage = () => {
  return (
    <MainLayout>
      <div className="px-3 sm:px-6 py-6 sm:py-10 pb-24 sm:pb-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B00]/30 bg-[#FF6B00]/10 px-3 py-1 text-xs font-semibold text-[#FF9500] mb-3">
              <Film className="h-3.5 w-3.5" />
              Studio Wideo · dla każdego
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">Rób wideo z tekstu 🎬</h1>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Opisz teledysk albo scenę, wybierz format — pionowy pod Reels/TikTok, poziomy pod YouTube,
              kwadrat pod feed — a AI zrobi z tego wideo. Dostępne dla wszystkich.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-4 sm:p-6 shadow-lg">
            <VideoStudio />
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default VideoStudioPage;
