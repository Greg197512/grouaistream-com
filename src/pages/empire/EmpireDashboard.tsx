import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Eye, DollarSign, Bot, Plus, ArrowRight,
  Flame, Trophy, Zap, TrendingUp,
} from "lucide-react";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { KpiCard } from "@/components/empire/KpiCard";
import { AgentProgressCard } from "@/components/empire/AgentProgressCard";
import { EmpireTree } from "@/components/empire/EmpireTree";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ACHIEVEMENTS = [
  { icon: "🔥", label: "7-dniowy streak", color: "text-orange-400" },
  { icon: "🏆", label: "Pierwszy 10k view", color: "text-yellow-400" },
  { icon: "🚀", label: "5 agentów jednocześnie", color: "text-teal-400" },
];

interface KpiSnapshot {
  content_generated: number | null;
  estimated_views: number | null;
  estimated_revenue_usd: number | null;
  active_agents: number | null;
}

interface AgentRow {
  name: string;
  status: string;
  run_count: number | null;
}

const formatViews = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

export default function EmpireDashboard() {
  const navigate = useNavigate();
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [projectCount, setProjectCount] = useState<number>(0);
  const [totalAgents, setTotalAgents] = useState<number>(0);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [kpiRes, projRes, agentRes] = await Promise.all([
        (supabase as any)
          .from("empire_kpi_snapshots")
          .select("content_generated, estimated_views, estimated_revenue_usd, active_agents")
          .eq("user_id", user.id)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("empire_projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        (supabase as any)
          .from("empire_agent_teams")
          .select("name, status, run_count")
          .eq("user_id", user.id)
          .order("last_run_at", { ascending: false })
          .limit(4),
      ]);

      setKpi(kpiRes.data ?? null);
      setProjectCount(projRes.count ?? 0);
      setTotalAgents(agentRes.data?.length ?? 0);
      setAgents(agentRes.data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const today = new Date().toLocaleDateString("pl-PL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

  const activeCount = agents.filter((a) => a.status === "running").length;

  const KPI_DATA = [
    {
      title: "Treści wygenerowane dziś",
      value: loading ? "—" : String(kpi?.content_generated ?? 0),
      delta: "Aktualne dane",
      deltaPositive: true,
      icon: <FileText className="w-5 h-5" />,
      gradient: "bg-gradient-to-br from-teal-500 to-teal-700",
    },
    {
      title: "Potencjalne wyświetlenia",
      value: loading ? "—" : formatViews(kpi?.estimated_views ?? 0),
      delta: "Łącznie",
      deltaPositive: true,
      icon: <Eye className="w-5 h-5" />,
      gradient: "bg-gradient-to-br from-purple-500 to-purple-700",
    },
    {
      title: "Dochód pasywny (est.)",
      value: loading ? "—" : `$${kpi?.estimated_revenue_usd ?? 0}`,
      delta: "Skumulowany",
      deltaPositive: true,
      icon: <DollarSign className="w-5 h-5" />,
      gradient: "bg-gradient-to-br from-yellow-500 to-orange-600",
    },
    {
      title: "Aktywne agenty",
      value: loading ? "—" : `${activeCount} / ${totalAgents}`,
      delta: `${projectCount} projektów`,
      deltaPositive: true,
      icon: <Bot className="w-5 h-5" />,
      gradient: "bg-gradient-to-br from-pink-500 to-rose-600",
    },
  ];

  const agentCards = agents.length > 0
    ? agents.map((a, i) => ({
        name: a.name,
        role: "Agent team",
        status: (a.status === "running" ? "running" : a.status === "done" ? "done" : "waiting") as "running" | "done" | "waiting",
        progress: a.status === "done" ? 100 : a.status === "running" ? 60 : 0,
        log: a.status === "running" ? `Uruchomień: ${a.run_count ?? 0}` : a.status === "done" ? `Ukończono ${a.run_count ?? 0} uruchomień` : "Oczekuje…",
        avatarGradient: [
          "bg-gradient-to-br from-teal-500 to-emerald-600",
          "bg-gradient-to-br from-purple-500 to-violet-600",
          "bg-gradient-to-br from-orange-500 to-red-600",
          "bg-gradient-to-br from-blue-500 to-cyan-600",
        ][i % 4],
      }))
    : [
        {
          name: "Brak agentów",
          role: "Utwórz swój pierwszy team",
          status: "waiting" as const,
          progress: 0,
          log: "Przejdź do Agent Builder →",
          avatarGradient: "bg-gradient-to-br from-teal-500 to-emerald-600",
        },
      ];

  return (
    <EmpireLayout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-white mb-1"
            >
              Twoje Imperium 🏰
            </motion.h1>
            <p className="text-sm text-white/45">{todayCapitalized} · Dzisiaj to dobry dzień na budowanie</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">7-dniowy streak</span>
            </div>
            <Button
              onClick={() => navigate("/empire/agents")}
              className="bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 border-0 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nowy Agent Team
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {KPI_DATA.map((kpiItem, i) => (
            <KpiCard key={kpiItem.title} {...kpiItem} index={i} />
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Empire Tree */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Mapa Imperium</h2>
              <button
                onClick={() => navigate("/empire/projects")}
                className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                Wszystkie <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <EmpireTree />
          </div>

          {/* Active Agents */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Aktywne Agenty</h2>
              <button
                onClick={() => navigate("/empire/agents")}
                className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
              >
                Zarządzaj <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agentCards.map((agent, i) => (
                <AgentProgressCard key={agent.name + i} {...agent} index={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Achievements */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold text-white text-sm">Ostatnie osiągnięcia</h2>
            </div>
            <div className="space-y-2">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.label} className="flex items-center gap-3 bg-white/3 rounded-xl px-4 py-3">
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-sm text-white/70">{a.label}</span>
                  <div className="ml-auto">
                    <Zap className={`w-4 h-4 ${a.color}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <h2 className="font-semibold text-white text-sm">Szybkie akcje</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Nowy projekt", icon: "🚀", to: "/empire/agents" },
                { label: "Knowledge Garden", icon: "🌱", to: "/empire/knowledge" },
                { label: "Marketplace", icon: "🛒", to: "/empire/marketplace" },
                { label: "Analytics", icon: "📊", to: "/empire/analytics" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
                  className="flex flex-col items-start gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all text-left group"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </EmpireLayout>
  );
}
