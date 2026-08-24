import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRef, useState, useEffect } from "react";

import { toast } from "sonner";

const navItems = [
  { icon: "home", labelKey: "nav.home", href: "/" },
  { icon: "search", labelKey: "nav.search", href: "/search" },
  { icon: "auto_awesome", labelKey: "nav.sunoAI", href: "/studio" },
  { icon: "smart_toy", labelKey: "nav.aiDj", href: "/ai-dj" },
  { icon: "library_music", labelKey: "nav.library", href: "/library" },
  { icon: "radio", labelKey: "nav.radioLive", href: "/radio-live" },
  { icon: "folder_open", labelKey: "nav.localPlayer", href: "/local-player" },
  { icon: "movie", labelKey: "nav.movies", href: "/movies" },
  { icon: "dns", labelKey: "nav.mediaServer", href: "/server" },
  { icon: "playlist_play", labelKey: "nav.managePlaylists", href: "/playlist-manager" },
  { icon: "favorite", labelKey: "nav.likedSongs", href: "/liked" },
  { icon: "psychology", labelKey: "nav.moodHistory", href: "/mood-history" },
  { icon: "handshake", labelKey: "nav.business", href: "/business", neon: true },
  { icon: "dashboard", labelKey: "nav.clientDashboard", href: "/client-dashboard", neon: true },
  { icon: "payments", labelKey: "nav.earnings", href: "/earnings", neon: true },
  { icon: "rocket_launch", labelKey: "nav.earnWithUs", href: "/earn", neon: true },
];

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 safe-bottom"
      style={{
        height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-1"
          style={{ background: "linear-gradient(to right, rgba(0,0,0,0.7) 60%, transparent)" }}
        >
          <span className="material-icons-outlined text-white/60 text-lg">chevron_left</span>
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center px-1"
          style={{ background: "linear-gradient(to left, rgba(0,0,0,0.7) 60%, transparent)" }}
        >
          <span className="material-icons-outlined text-white/60 text-lg">chevron_right</span>
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-center h-full overflow-x-auto"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const isNeon = (item as any).neon;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 my-1 rounded-2xl transition-all flex-shrink-0",
                isActive ? "text-primary bg-primary/10 ring-1 ring-primary/30" : isNeon ? "text-accent" : "text-muted-foreground"
              )}
              style={{
                scrollSnapAlign: "center",
                minWidth: "4rem",
                ...(isActive ? { boxShadow: "0 0 18px hsl(268 100% 66% / 0.35)" } : {}),
                ...(isNeon ? {
                  filter: isActive
                    ? "drop-shadow(0 0 8px hsl(331 100% 62% / 0.85))"
                    : "drop-shadow(0 0 5px hsl(331 100% 62% / 0.5))",
                } : {}),
              }}
            >
              <span className="material-icons-outlined text-xl">{item.icon}</span>
              <span className="text-[9px] font-medium whitespace-nowrap">{t(item.labelKey)}</span>
            </button>
          );
        })}

        {/* Account / Sign In */}
        <button
          onClick={() => navigate(user ? "/settings" : "/auth")}
          className={cn(
            "flex flex-col items-center gap-0.5 py-1 px-3 transition-colors relative flex-shrink-0",
            (location.pathname === "/settings" || location.pathname === "/auth")
              ? "text-primary"
              : "text-muted-foreground"
          )}
          style={{ scrollSnapAlign: "center", minWidth: "4rem" }}
        >
          <span className="material-icons-outlined text-xl">
            {user ? "account_circle" : "login"}
          </span>
          {user && (
            <span className="absolute top-0.5 right-2 h-2 w-2 rounded-full bg-emerald-500 border border-background" />
          )}
          <span className="text-[9px] font-medium whitespace-nowrap">
            {user ? t("nav.settings") : t("topbar.signIn")}
          </span>
        </button>

        {/* Logout button - only when logged in */}
        {user && (
          <button
            onClick={async () => {
              await signOut();
              toast.success(t("settings.signOutSuccess"));
              navigate("/");
            }}
            className="flex flex-col items-center gap-0.5 py-1 px-3 transition-colors flex-shrink-0 text-destructive"
            style={{ scrollSnapAlign: "center", minWidth: "4rem" }}
          >
            <span className="material-icons-outlined text-xl">logout</span>
            <span className="text-[9px] font-medium whitespace-nowrap">{t("topbar.signOut")}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
