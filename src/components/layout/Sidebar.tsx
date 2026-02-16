import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "search", label: "Search", href: "/search" },
  { icon: "library_music", label: "Your Library", href: "/library" },
];

const playlistItems = [
  { icon: "add_circle", label: "Create Playlist", href: "/create-playlist" },
  { icon: "favorite", label: "Liked Songs", href: "/liked" },
  { icon: "swap_horiz", label: "Manage Playlists", href: "/playlist-manager" },
  { icon: "radio", label: "GrouaRadio Live", href: "/radio", badge: "LIVE" },
  { icon: "download", label: "Import YouTube", href: "/import-youtube" },
];

const aiFeatures = [
  { icon: "smart_toy", label: "AI DJ", href: "/ai-dj" },
  { icon: "face", label: "Mood Detection", href: "/" },
  { icon: "history", label: "Mood History", href: "/mood-history" },
  { icon: "autorenew", label: "Real-time Adaptation", href: "/daily-mix" },
  { icon: "admin_panel_settings", label: "Admin Panel", href: "/admin", adminOnly: true },
];

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItem, setActiveItem] = useState(location.pathname);

  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location.pathname]);

  const handleNavClick = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, "_blank");
      return;
    }
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
      <div className="flex h-20 items-center gap-3 px-6">
        <motion.div 
          className="groove-gradient-bg flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl cursor-pointer"
          whileHover={{ scale: 1.05, rotate: 5 }}
          onClick={() => handleNavClick("/")}
        >
          <span className="material-icons text-primary-foreground text-xl">music_note</span>
        </motion.div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="cursor-pointer"
            onClick={() => handleNavClick("/")}
          >
            <h1 className="font-display text-xl font-bold groove-gradient-text">
              GrouAI Stream
            </h1>
            <p className="text-xs text-muted-foreground"><span className="text-accent">by Groua</span></p>
          </motion.div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-24 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-secondary border border-border hover:bg-muted transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto groove-scrollbar px-3 py-4">
        {/* Main Nav */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={activeItem === item.href}
              collapsed={collapsed}
              onClick={() => handleNavClick(item.href)}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-border" />

        {/* Playlists */}
        <div className="space-y-1">
          {playlistItems.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={activeItem === item.href}
              collapsed={collapsed}
              onClick={() => handleNavClick(item.href)}
              badge={item.badge}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-border" />

        {/* AI Features */}
        {!collapsed && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            AI Features
          </motion.p>
        )}
        <div className="space-y-1">
          {aiFeatures.map((item) => (
            <NavItem
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
              active={activeItem === item.href}
              collapsed={collapsed}
              onClick={() => handleNavClick(item.href)}
              isAI
            />
          ))}
        </div>
      </nav>

      {/* Settings */}
      <div className="border-t border-border p-3">
        <NavItem
          icon="settings"
          label="Settings"
          href="/settings"
          active={activeItem === "/settings"}
          collapsed={collapsed}
          onClick={() => handleNavClick("/settings")}
        />
      </div>
    </motion.aside>
  );
};

interface NavItemProps {
  icon: string;
  label: string;
  href: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: string;
  isAI?: boolean;
}

const NavItem = ({ 
  icon, 
  label, 
  active, 
  collapsed, 
  onClick, 
  badge,
  isAI 
}: NavItemProps) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
        collapsed && "justify-center px-2"
      )}
    >
      <span className={cn(
        "material-icons-outlined text-xl flex-shrink-0",
        isAI && "text-accent",
        active && isAI && "text-accent",
        active && !isAI && "text-primary"
      )}>
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
};