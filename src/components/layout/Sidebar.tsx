import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Home, 
  Search, 
  Library, 
  PlusCircle, 
  Heart, 
  Radio, 
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: Library, label: "Your Library", href: "/library" },
];

const playlistItems = [
  { icon: PlusCircle, label: "Create Playlist", href: "/create-playlist" },
  { icon: Heart, label: "Liked Songs", href: "/liked" },
  { icon: Radio, label: "GrouaRadio Live", href: "/radio", badge: "LIVE" },
];

const aiFeatures = [
  { icon: Sparkles, label: "AI DJ", href: "/ai-dj" },
  { icon: TrendingUp, label: "Mood Analysis", href: "/mood" },
  { icon: Clock, label: "Daily Mix", href: "/daily-mix" },
  { icon: Users, label: "Social Hub", href: "/social" },
];

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItem, setActiveItem] = useState(location.pathname);

  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location.pathname]);

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
      <div className="flex h-20 items-center gap-3 px-6">
        <motion.div 
          className="groove-gradient-bg flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl cursor-pointer"
          whileHover={{ scale: 1.05, rotate: 5 }}
          onClick={() => handleNavClick("/")}
        >
          <Sparkles className="h-5 w-5 text-primary-foreground" />
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
              GrooveAI
            </h1>
            <p className="text-xs text-muted-foreground">Stream</p>
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
          icon={Settings}
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
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: string;
  isAI?: boolean;
}

const NavItem = ({ 
  icon: Icon, 
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
      <Icon className={cn(
        "h-5 w-5 flex-shrink-0",
        isAI && "text-accent",
        active && isAI && "text-accent"
      )} />
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
