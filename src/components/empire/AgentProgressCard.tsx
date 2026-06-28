import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

type AgentStatus = "running" | "done" | "waiting";

interface AgentProgressCardProps {
  name: string;
  role: string;
  status: AgentStatus;
  progress: number;
  log?: string;
  avatarGradient: string;
  index?: number;
}

const statusConfig: Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  running: {
    label: "Aktywny",
    color: "text-teal-400",
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  done: {
    label: "Gotowy",
    color: "text-emerald-400",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  waiting: {
    label: "Oczekuje",
    color: "text-white/40",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

export function AgentProgressCard({
  name,
  role,
  status,
  progress,
  log,
  avatarGradient,
  index = 0,
}: AgentProgressCardProps) {
  const cfg = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0",
            avatarGradient
          )}
        >
          {name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <p className="text-xs text-white/40">{role}</p>
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", cfg.color)}>
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            status === "done"
              ? "bg-emerald-500"
              : status === "running"
              ? "bg-gradient-to-r from-teal-500 to-purple-500"
              : "bg-white/20"
          )}
        />
      </div>

      {log && (
        <p className="text-[11px] text-white/35 truncate font-mono">{log}</p>
      )}
    </motion.div>
  );
}
