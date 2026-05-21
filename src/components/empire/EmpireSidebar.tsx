import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, FolderKanban, Bot, BookOpen,
  ShoppingBag, BarChart3, Users, ChevronLeft,
  ChevronRight, Crown, Zap, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",       to: "/empire" },
  { icon: FolderKanban,   label: "Moje Projekty",    to: "/empire/projects" },
  { icon: Bot,            label: "Agent Teams",      to: "/empire/agents" },
  { icon: BookOpen,       label: "Knowledge Garden", to: "/empire/knowledge" },
  { icon: ShoppingBag,    label: "Marketplace",      to: "/empire/marketplace" },
  { icon: BarChart3,      label: "Analytics",        to: "/empire/analytics" },
  { icon: Users,          label: "Community",        to: "/empire/community" },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function EmpireSidebar({ collapsed, onToggle }: Props) {
  const { user } = useAuth();

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen bg-black/70 backdrop-blur-xl border-r border-white/8 flex flex-col flex-shrink-0 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-white/8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
          <Crown className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm bg-gradient-to-r from-teal-400 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
            CreatorForge AI
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto text-white/30 hover:text-white/70 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/8">
            <Search className="w-3.5 h-3.5 text-white/30" />
            <input
              placeholder="Szukaj w imperium…"
              className="bg-transparent text-xs text-white/70 placeholder:text-white/30 outline-none flex-1"
            />
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/empire"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group",
                isActive
                  ? "bg-gradient-to-r from-teal-500/20 to-purple-500/20 text-teal-300 border border-teal-500/20"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <span className="whitespace-nowrap text-[13px]">{label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/8 p-3 space-y-2">
        {!collapsed && (
          <div className="bg-gradient-to-r from-teal-500/10 to-purple-500/10 rounded-lg p-2.5 border border-teal-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs text-white/50">AI Kredyty</span>
              <span className="ml-auto text-xs font-semibold text-yellow-400">1 240</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-3/5 bg-gradient-to-r from-teal-500 to-purple-500 rounded-full" />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60 truncate">{user?.email ?? "Gość"}</p>
              <p className="text-xs text-teal-400 font-semibold">Lvl 3 · Builder</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
