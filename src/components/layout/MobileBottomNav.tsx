import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: "home", labelKey: "nav.home", href: "/" },
  { icon: "search", labelKey: "nav.search", href: "/search" },
  { icon: "auto_awesome", labelKey: "nav.sunoAI", href: "/suno" },
  { icon: "library_music", labelKey: "nav.library", href: "/library" },
  { icon: "radio", labelKey: "nav.radioLive", href: "/radio-live" },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border/50 safe-bottom"
      style={{
        height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
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

      {/* Account / Sign In */}
      <button
        onClick={() => navigate(user ? "/settings" : "/auth")}
        className={cn(
          "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors relative",
          (location.pathname === "/settings" || location.pathname === "/auth")
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        <span className="material-icons-outlined text-xl">
          {user ? "account_circle" : "login"}
        </span>
        {user && (
          <span className="absolute top-0.5 right-2 h-2 w-2 rounded-full bg-emerald-500 border border-background" />
        )}
        <span className="text-[9px] font-medium">
          {user ? t("nav.settings") : t("topbar.signIn")}
        </span>
      </button>
    </nav>
  );
};
