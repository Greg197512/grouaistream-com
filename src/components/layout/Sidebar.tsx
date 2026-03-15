import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import logoIcon from "@/assets/logo-full.png";
import { MatrixNotes } from "@/components/effects/MatrixNotes";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [activeItem, setActiveItem] = useState(location.pathname);
  const [matrixEnabled, setMatrixEnabled] = useState(true);

  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location.pathname]);

  const navItems = [
    { icon: "home", labelKey: "nav.home", href: "/" },
    { icon: "search", labelKey: "nav.search", href: "/search" },
    { icon: "library_music", labelKey: "nav.library", href: "/library" },
  ];

  const playlistItems = [
    { icon: "add_circle", labelKey: "nav.createPlaylist", href: "/create-playlist" },
    { icon: "favorite", labelKey: "nav.likedSongs", href: "/liked" },
    { icon: "swap_horiz", labelKey: "nav.managePlaylists", href: "/playlist-manager" },
    { icon: "dns", labelKey: "nav.mediaServer", href: "/server" },
    { icon: "movie", labelKey: "nav.movies", href: "/movies" },
    { icon: "radio", labelKey: "nav.radioLive", href: "/radio-live", badge: "LIVE" },
    { icon: "download", labelKey: "nav.importYoutube", href: "/import-youtube" },
    { icon: "auto_awesome", labelKey: "nav.sunoAI", href: "/suno", badge: "🎵" },
    { icon: "headphones", labelKey: "nav.localPlayer", href: "/local-player", badge: "MP3" },
  ];

  const aiFeatures = [
    { icon: "smart_toy", labelKey: "nav.aiDj", href: "/ai-dj" },
    { icon: "face", labelKey: "nav.moodDetection", href: "/" },
    { icon: "history", labelKey: "nav.moodHistory", href: "/mood-history" },
    { icon: "autorenew", labelKey: "nav.realtimeAdaptation", href: "/daily-mix" },
    { icon: "admin_panel_settings", labelKey: "nav.adminPanel", href: "/admin", adminOnly: true },
  ];

  const handleNavClick = (href: string) => {
    setActiveItem(href);
    navigate(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative flex h-full flex-col bg-sidebar border-r border-sidebar-border"
    >
      {/* Logo */}
      <div className="flex h-24 items-center gap-3 px-4">
        {collapsed ? (
          <motion.div 
            className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl cursor-pointer mx-auto"
            whileHover={{ scale: 1.1, rotate: 5 }}
            onClick={() => handleNavClick("/")}
          >
            <div className="absolute -inset-4 overflow-hidden">
              <MatrixNotes enabled={matrixEnabled} />
            </div>
            <img src="/logo-icon.png" alt="GrouAI Stream" className="h-14 w-14 object-contain drop-shadow-[0_0_12px_hsl(var(--primary)/0.5)] relative z-10" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="relative cursor-pointer flex items-center"
            onClick={() => handleNavClick("/")}
            whileHover={{ scale: 1.03 }}
          >
            <div className="absolute -inset-6 overflow-hidden">
              <MatrixNotes enabled={matrixEnabled} />
            </div>
            <img src={logoIcon} alt="GrouAI Stream by GrouaRock" className="h-24 object-contain relative z-10" />
          </motion.div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-24 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-secondary border border-border hover:bg-muted transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto groove-scrollbar px-3 py-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.href} icon={item.icon} label={t(item.labelKey)} active={activeItem === item.href} collapsed={collapsed} onClick={() => handleNavClick(item.href)} />
          ))}
        </div>

        <div className="my-4 h-px bg-border" />

        <div className="space-y-1">
          {playlistItems.map((item) => (
            <NavItem key={item.href} icon={item.icon} label={t(item.labelKey)} active={activeItem === item.href} collapsed={collapsed} onClick={() => handleNavClick(item.href)} badge={item.badge} />
          ))}
        </div>

        <div className="my-4 h-px bg-border" />

        {!collapsed && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("nav.aiFeatures")}
          </motion.p>
        )}
        <div className="space-y-1">
          {aiFeatures.map((item) => (
            <NavItem key={item.href + item.labelKey} icon={item.icon} label={t(item.labelKey)} active={activeItem === item.href} collapsed={collapsed} onClick={() => handleNavClick(item.href)} isAI />
          ))}
        </div>
      </nav>

      {/* Settings & Legal */}
      <div className="border-t border-border p-3 space-y-1">
        <NavItem icon="settings" label={t("nav.settings")} active={activeItem === "/settings"} collapsed={collapsed} onClick={() => handleNavClick("/settings")} />
        <NavItem icon="gavel" label={t("nav.legalDocs")} active={activeItem === "/legal"} collapsed={collapsed} onClick={() => handleNavClick("/legal")} />
        {/* Matrix notes toggle */}
        <button
          onClick={() => setMatrixEnabled(!matrixEnabled)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            matrixEnabled ? "text-accent" : "text-muted-foreground hover:text-sidebar-foreground",
            collapsed && "justify-center px-2"
          )}
          title={matrixEnabled ? "Wyłącz efekt nut" : "Włącz efekt nut"}
        >
          <span className={cn(
            "h-3 w-3 rounded-full border-2 transition-all flex-shrink-0",
            matrixEnabled 
              ? "bg-accent border-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)]" 
              : "bg-transparent border-muted-foreground"
          )} />
          {!collapsed && <span className="text-left truncate">{matrixEnabled ? "♪ Efekt 3D: ON" : "♪ Efekt 3D: OFF"}</span>}
        </button>
      </div>
    </motion.aside>
  );
};

interface NavItemProps {
  icon: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: string;
  isAI?: boolean;
}

const NavItem = ({ icon, label, active, collapsed, onClick, badge, isAI }: NavItemProps) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 2 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
      active ? "bg-sidebar-accent text-sidebar-foreground" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
      collapsed && "justify-center px-2"
    )}
  >
    <span className={cn("material-icons-outlined text-xl flex-shrink-0", isAI && "text-accent", active && isAI && "text-accent", active && !isAI && "text-primary")}>
      {icon}
    </span>
    {!collapsed && (
      <>
        <span className="flex-1 text-left truncate">{label}</span>
        {badge && (
          <span className="groove-gradient-bg px-2 py-0.5 rounded-full text-[10px] font-bold text-primary-foreground animate-pulse">
            {badge}
          </span>
        )}
      </>
    )}
  </motion.button>
);
