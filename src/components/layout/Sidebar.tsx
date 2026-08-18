import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import logoIcon from "@/assets/logo-full.png";
import { MatrixNotes } from "@/components/effects/MatrixNotes";
import { useEffects3D } from "@/contexts/Effects3DContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [activeItem, setActiveItem] = useState(location.pathname);
  const { is3D, toggle: toggle3D } = useEffects3D();

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
    { icon: "auto_awesome", labelKey: "nav.sunoAI", href: "/studio", badge: "🎵" },
    { icon: "movie_creation", labelKey: "nav.videoStudio", href: "/video", badge: "🎬" },
    { icon: "headphones", labelKey: "nav.localPlayer", href: "/local-player", badge: "MP3" },
    { icon: "queue_music", labelKey: "nav.myTracks", href: "/my-tracks" },
    { icon: "account_balance_wallet", labelKey: "nav.earnings", href: "/earnings", badge: "💰" },
    { icon: "monetization_on", labelKey: "nav.earnWithUs", href: "/earn", badge: "🤑" },
    { icon: "mic", labelKey: "nav.artistLanding", href: "/artysta", badge: "🎤" },
  ];

  const aiFeatures = [
    { icon: "smart_toy", labelKey: "nav.aiDj", href: "/ai-dj" },
    { icon: "face", labelKey: "nav.moodDetection", href: "/" },
    { icon: "history", labelKey: "nav.moodHistory", href: "/mood-history" },
    { icon: "autorenew", labelKey: "nav.realtimeAdaptation", href: "/daily-mix" },
    { icon: "waves", labelKey: "nav.binaural", href: "/binaural", badge: "NEW" },
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
              <MatrixNotes enabled={is3D} />
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
              <MatrixNotes enabled={is3D} />
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

        {/* Business B2B — animated blue glow */}
        <button
          onClick={() => handleNavClick("/business")}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all overflow-hidden",
            "bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-transparent",
            "border border-cyan-400/30 hover:border-cyan-300/70",
            "shadow-[0_0_15px_hsl(210_100%_50%/0.15)] hover:shadow-[0_0_25px_hsl(210_100%_50%/0.4)]",
            activeItem === "/business" && "border-cyan-300 shadow-[0_0_25px_hsl(210_100%_50%/0.45)]",
            collapsed && "justify-center px-2"
          )}
        >
          <span className="absolute inset-0 -z-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-cyan-400/0 via-cyan-300/20 to-blue-500/0 animate-[shimmer_2s_ease-in-out_infinite]" />
          <span className="material-icons-outlined text-xl text-cyan-300 relative z-10 animate-pulse">business_center</span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate relative z-10 bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">
                Business · B2B
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-400 text-background relative z-10">NEW</span>
            </>
          )}
        </button>

        <div className="my-3 h-px bg-border" />

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
        {/* Przełącznik prawdziwego trybu 3D (wypukłe kafelki + przechył pod kursorem/żyroskopem) */}
        <button
          onClick={toggle3D}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            is3D ? "text-accent" : "text-muted-foreground hover:text-sidebar-foreground",
            collapsed && "justify-center px-2"
          )}
          title={is3D ? "Wyłącz efekt 3D" : "Włącz efekt 3D"}
        >
          <span className={cn(
            "h-3 w-3 rounded-full border-2 transition-all flex-shrink-0",
            is3D
              ? "bg-accent border-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)]"
              : "bg-transparent border-muted-foreground"
          )} />
          {!collapsed && <span className="text-left truncate">{is3D ? "✦ Efekt 3D: ON" : "✦ Efekt 3D: OFF"}</span>}
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
    whileTap={{ scale: 0.98 }}
    className={cn(
      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium overflow-hidden",
      "border border-transparent transition-all duration-300",
      // Prawdziwe szkło + POMARAŃCZOWA poświata na hover (jak cała strona)
      "hover:backdrop-blur-md hover:bg-[hsl(28_100%_55%/0.10)] hover:border-[hsl(32_100%_62%/0.5)]",
      "hover:shadow-[inset_0_1px_0_hsl(44_100%_82%/0.55),inset_0_0_18px_hsl(28_100%_55%/0.20),0_8px_32px_hsl(24_100%_52%/0.45)]",
      active
        ? "bg-sidebar-accent text-sidebar-foreground border-white/10"
        : "text-muted-foreground hover:text-[hsl(40_100%_88%)]",
      collapsed && "justify-center px-2"
    )}
  >
    {/* Górny połysk szklanej butelki (ciepłe światło) */}
    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-[hsl(44_100%_82%/0.32)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    {/* Refleks światła przejeżdżający po szkle (pomarańczowy) */}
    <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-[hsl(40_100%_78%/0.55)] to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-[420%] transition-all duration-700 ease-out" />

    <span className={cn(
      "material-icons-outlined text-xl flex-shrink-0 relative z-10 transition-all duration-300 group-hover:scale-110 group-hover:text-[hsl(32_100%_62%)] group-hover:drop-shadow-[0_0_8px_hsl(28_100%_55%/0.7)]",
      isAI && "text-accent", active && isAI && "text-accent", active && !isAI && "text-primary"
    )}>
      {icon}
    </span>
    {!collapsed && (
      <>
        {/* Nazwa „zapala się" pomarańczem w środku szkła */}
        <span className="flex-1 text-left truncate relative z-10 transition-all duration-300 group-hover:tracking-wide group-hover:[text-shadow:0_0_12px_hsl(28_100%_55%/0.85),0_0_4px_hsl(44_100%_80%/0.6)]">
          {label}
        </span>
        {badge && (
          <span className="groove-gradient-bg px-2 py-0.5 rounded-full text-[10px] font-bold text-primary-foreground animate-pulse relative z-10">
            {badge}
          </span>
        )}
      </>
    )}
  </motion.button>
);
