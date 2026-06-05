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

const KPI_DATA = [
  {
    title: "Treści wygenerowane dziś",
    value: "12",
    delta: "+3 vs wczoraj",
    deltaPositive: true,
    icon: <FileText className="w-5 h-5" />,
    gradient: "bg-gradient-to-br from-teal-500 to-teal-700",
  },
  {
    title: "Potencjalne wyświetlenia",
    value: "47.2k",
    delta: "+12.4%",
    deltaPositive: true,
    icon: <Eye className="w-5 h-5" />,
    gradient: "bg-gradient-to-br from-purple-500 to-purple-700",
  },
  {
    title: "Dochód pasywny (est.)",
    value: "$127",
    delta: "+$23 ten tydzień",
    deltaPositive: true,
    icon: <DollarSign className="w-5 h-5" />,
    gradient: "bg-gradient-to-br from-yellow-500 to-orange-600",
  },
  {
    title: "Aktywne agenty",
    value: "4 / 7",
    delta: "2 w kolejce",
    deltaPositive: true,
    icon: <Bot className="w-5 h-5" />,
    gradient: "bg-gradient-to-br from-pink-500 to-rose-600",
  },
];

const AGENTS = [
  {
    name: "Script Writer Pro",
    role: "Pisarz treści",
    status: "running" as const,
    progress: 80,
    log: "Generowanie skryptu #48: '30-Day Challenge Intro'...",
    avatarGradient: "bg-gradient-to-br from-teal-500 to-emerald-600",
  },
  {
    name: "Research Agent",
    role: "Zbieracz danych",
    status: "done" as const,
    progress: 100,
    log: "Zebrano 47 artykułów źródłowych • done",
    avatarGradient: "bg-gradient-to-br from-purple-500 to-violet-600",
  },
  {
    name: "Video Producer",
    role: "Montaż wideo",
    status: "running" as const,
    progress: 45,
    log: "Renderowanie klatki 1240/2700...",
    avatarGradient: "bg-gradient-to-br from-orange-500 to-red-600",
  },
  {
    name: "Publisher Bot",
    role: "Publikacja",
    status: "waiting" as const,
    progress: 0,
    log: "Oczekuje na Video Producer...",
    avatarGradient: "bg-gradient-to-br from-blue-500 to-cyan-600",
  },
];

const ACHIEVEMENTS = [
  { icon: "🔥", label: "7-dniowy streak", color: "text-orange-400" },
  { icon: "🏆", label: "Pierwszy 10k view", color: "text-yellow-400" },
  { icon: "🚀", label: "5 agentów jednocześnie", color: "text-teal-400" },
];

export default function EmpireDashboard() {
  const navigate = useNavigate();

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
            <p className="text-sm text-white/45">Czwartek, 21 maja 2026 · Dzisiaj to dobry dzień na budowanie</p>
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
          {KPI_DATA.map((kpi, i) => (
            <KpiCard key={kpi.title} {...kpi} index={i} />
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
              {AGENTS.map((agent, i) => (
                <AgentProgressCard key={agent.name} {...agent} index={i} />
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
