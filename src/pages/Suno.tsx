import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { MusicGenerateModal } from "@/components/modals/MusicGenerateModal";
import { Button } from "@/components/ui/button";
import { Waves, Music, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const Suno = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-lg"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Waves className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold">AI Music Generator</h1>
          <p className="text-muted-foreground">
            Twórz unikalne utwory muzyczne algorytmicznie. Wybierz styl, ustaw długość i wygeneruj muzykę bezpośrednio w przeglądarce — bez zewnętrznych API, za darmo!
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            {["Pop", "Rock", "Electronic", "Hip-Hop", "Jazz", "Lo-fi", "Ambient", "Metal"].map((g) => (
              <span key={g} className="px-2 py-1 rounded-full border border-border bg-secondary/30">{g}</span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
          <Button
            onClick={() => setShowModal(true)}
            size="lg"
            className="gap-3 h-14 px-8 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl shadow-purple-500/25"
          >
            <Sparkles className="h-5 w-5" />
            Generuj utwór
            <Music className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      <MusicGenerateModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </MainLayout>
  );
};

export default Suno;
