import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const navItems = [
  { icon: "home", labelKey: "nav.home", href: "/" },
  { icon: "search", labelKey: "nav.search", href: "/search" },
  { icon: "library_music", labelKey: "nav.library", href: "/library" },
  { icon: "radio", labelKey: "nav.radioLive", href: "/radio-live" },
  { icon: "settings", labelKey: "nav.settings", href: "/settings" },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-14 border-t border-border/50"
      style={{
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <button
            key={item.href}
            onClick={() => navigate(item.href)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <span className="material-icons-outlined text-xl">{item.icon}</span>
            <span className="text-[9px] font-medium">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
};
