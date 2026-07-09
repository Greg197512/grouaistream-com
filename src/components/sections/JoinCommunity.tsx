import { motion } from "framer-motion";
import { MessageCircle, Users, Radio } from "lucide-react";

export const DISCORD_INVITE_URL = "https://discord.gg/5R7vrpGSER";

export const JoinCommunity = () => {
  return (
    <section className="px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto max-w-3xl"
      >
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-background p-8 text-center shadow-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-4">
            <Users className="h-3.5 w-3.5" />
            Społeczność
          </div>

          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Dołącz do nas na Discordzie 🎧
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-lg mx-auto">
            Nowości z platformy, premiery utworów, Groua Radio i rozmowy z twórcami —
            wszystko w jednym miejscu. Wpadaj, miejsce dla każdego.
          </p>

          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-indigo-400 hover:scale-105"
          >
            <MessageCircle className="h-5 w-5" />
            Dołącz do serwera
          </a>

          <div className="mt-6 flex items-center justify-center gap-6 text-[11px] text-muted-foreground/60">
            <span className="inline-flex items-center gap-1">
              <Radio className="h-3 w-3" /> ogłoszenia i nowości
            </span>
            <span>· darmowe ·</span>
            <span>bez spamu</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
