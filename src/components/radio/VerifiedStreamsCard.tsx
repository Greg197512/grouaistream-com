import { motion } from "framer-motion";
import { Shield, Users, TrendingUp, Eye, Zap, Lock } from "lucide-react";

const STATS = [
  { icon: Shield, label: "Anti-Bot Protection", value: "Active", color: "text-emerald-400" },
  { icon: Users, label: "Verified Listeners", value: "100%", color: "text-primary" },
  { icon: TrendingUp, label: "Fair Royalties", value: "$0.0007/stream", color: "text-yellow-400" },
];

const FEATURES = [
  { icon: Lock, text: "Rate-limiting: 1 stream/track/user/h" },
  { icon: Eye, text: "Śledzenie źródła: radio, playlist, DJ" },
  { icon: Zap, text: "Min. 30s odtwarzania = zaliczony stream" },
];

export const VerifiedStreamsCard = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-card/90 to-emerald-950/20 backdrop-blur-sm p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            Verified Human Streams
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold uppercase tracking-wider">
              Innowacja
            </span>
          </h3>
          <p className="text-[10px] text-muted-foreground">Zero botów. Prawdziwe odsłuchania. Uczciwe tantiemy.</p>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 rounded-lg bg-card/50 border border-border/20 p-2">
            <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
            <span className={`text-xs font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-[9px] text-muted-foreground text-center leading-tight">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Features list */}
      <div className="space-y-1.5">
        {FEATURES.map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className="flex items-center gap-2 text-[11px] text-muted-foreground"
          >
            <feat.icon className="h-3 w-3 text-emerald-400 shrink-0" />
            <span>{feat.text}</span>
          </motion.div>
        ))}
      </div>

      {/* Comparison callout */}
      <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Dlaczego to ważne?</strong> Na Spotify boty generują miliony 
          fałszywych streamów. GrouAI Stream weryfikuje każde odsłuchanie — artyści zarabiają tylko z prawdziwych fanów.
          Pełna transparentność: źródło, kraj, czas trwania.
        </p>
      </div>
    </motion.div>
  );
};
