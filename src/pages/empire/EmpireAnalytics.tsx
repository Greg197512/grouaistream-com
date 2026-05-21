import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Eye, DollarSign, FileText,
  Calendar, ArrowUpRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { EmpireLayout } from "@/components/empire/EmpireLayout";
import { KpiCard } from "@/components/empire/KpiCard";

const DAILY_DATA = [
  { day: "15 maj", views: 1200, content: 4, revenue: 12 },
  { day: "16 maj", views: 1900, content: 6, revenue: 18 },
  { day: "17 maj", views: 3200, content: 8, revenue: 31 },
  { day: "18 maj", views: 2800, content: 5, revenue: 27 },
  { day: "19 maj", views: 4100, content: 10, revenue: 42 },
  { day: "20 maj", views: 5600, content: 9, revenue: 55 },
  { day: "21 maj", views: 7200, content: 12, revenue: 71 },
];

const AGENT_DATA = [
  { name: "Script Writer", tasks: 47, success: 45 },
  { name: "Researcher", tasks: 38, success: 38 },
  { name: "Video Producer", tasks: 22, success: 20 },
  { name: "Publisher", tasks: 61, success: 59 },
  { name: "Voice Artist", tasks: 15, success: 14 },
];

const PLATFORM_DATA = [
  { name: "TikTok", value: 45, color: "#0d9488" },
  { name: "YouTube", value: 28, color: "#7c3aed" },
  { name: "Newsletter", value: 17, color: "#f59e0b" },
  { name: "LinkedIn", value: 10, color: "#3b82f6" },
];

const TOP_CONTENT = [
  { title: "Morning Routine in 5 min - AI Generated", platform: "TikTok", views: "24.3k", revenue: "$48" },
  { title: "AI Newsletter #12: Trendy 2026", platform: "Email", views: "8.1k", revenue: "$31" },
  { title: "30-Day AI Fitness Challenge", platform: "YouTube", views: "15.7k", revenue: "$62" },
  { title: "Jak zarobić z AI w 2026", platform: "LinkedIn", views: "6.4k", revenue: "$19" },
];

const TooltipStyle = {
  contentStyle: {
    background: "rgba(0,0,0,0.85)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "12px",
  },
};

export default function EmpireAnalytics() {
  return (
    <EmpireLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BarChart3 className="w-6 h-6 text-teal-400" />
              <h1 className="text-2xl font-bold text-white">Analytics & Empire Stats</h1>
            </div>
            <p className="text-white/45 text-sm">Ostatnie 7 dni · Wszystkie projekty</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <Calendar className="w-4 h-4 text-white/40" />
            <span className="text-sm text-white/60">15 - 21 maja 2026</span>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard title="Łączne wyświetlenia" value="26.0k" delta="+187% vs ub. tydzień" deltaPositive icon={<Eye className="w-5 h-5" />} gradient="bg-gradient-to-br from-teal-500 to-teal-700" index={0} />
          <KpiCard title="Treści opublikowane" value="54" delta="+12 vs ub. tydzień" deltaPositive icon={<FileText className="w-5 h-5" />} gradient="bg-gradient-to-br from-purple-500 to-purple-700" index={1} />
          <KpiCard title="Przychód (est.)" value="$256" delta="+$89 vs ub. tydzień" deltaPositive icon={<DollarSign className="w-5 h-5" />} gradient="bg-gradient-to-br from-yellow-500 to-orange-600" index={2} />
          <KpiCard title="ROI na agenta" value="4.2x" delta="+0.8x vs ub. tydzień" deltaPositive icon={<TrendingUp className="w-5 h-5" />} gradient="bg-gradient-to-br from-pink-500 to-rose-600" index={3} />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Views area chart */}
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Wyświetlenia & Przychód</h2>
              <span className="text-xs text-teal-400 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> +187%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={DAILY_DATA}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TooltipStyle} />
                <Area type="monotone" dataKey="views" stroke="#0d9488" strokeWidth={2} fill="url(#viewsGrad)" name="Wyświetlenia" />
                <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#revenueGrad)" name="Przychód $" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform pie */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-5">Podział platform</h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={PLATFORM_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {PLATFORM_DATA.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip {...TooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-3">
              {PLATFORM_DATA.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <span className="text-xs text-white/60 flex-1">{p.name}</span>
                  <span className="text-xs font-semibold text-white">{p.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agent performance */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-5">Wydajność agentów</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={AGENT_DATA} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip {...TooltipStyle} />
                <Bar dataKey="tasks" fill="rgba(13,148,136,0.3)" radius={[0, 4, 4, 0]} name="Zadania" />
                <Bar dataKey="success" fill="#0d9488" radius={[0, 4, 4, 0]} name="Sukces" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top content */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-5">Top content tego tygodnia</h2>
            <div className="space-y-3">
              {TOP_CONTENT.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-lg font-bold text-white/20 w-6 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{item.title}</p>
                    <p className="text-xs text-white/35">{item.platform}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-teal-400">{item.views}</p>
                    <p className="text-xs text-white/40">{item.revenue}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </EmpireLayout>
  );
}
