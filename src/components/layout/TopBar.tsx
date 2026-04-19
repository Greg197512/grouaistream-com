import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, ChevronRight, Search, Bell, User, Crown, LogOut,
  Settings, Sparkles, UserCircle, Heart, Library, Power, Globe, Music,
  Coins, Trophy, MessageCircle, FileText, Flame, Radio, Gift
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UpgradeModal } from "@/components/modals/UpgradeModal";
import { Language } from "@/i18n/translations";
import { useNotificationsFeed, FeedItem } from "@/hooks/useNotificationsFeed";

const ICONS: Record<FeedItem["icon"], React.ComponentType<{ className?: string }>> = {
  heart: Heart,
  coin: Coins,
  trophy: Trophy,
  comment: MessageCircle,
  blog: FileText,
  challenge: Flame,
  stream: Radio,
  tip: Gift,
};

export const TopBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { items, unreadCount, markAllSeen, since } = useNotificationsFeed();
  
  const { user, signOut, loading } = useAuth();
  const { language, setLanguage, t, languageNames, languageFlags } = useLanguage();
  
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(t("settings.signOutSuccess"));
      navigate("/");
    } catch (error) {
      toast.error("Failed to sign out");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Navigate to search page as user types
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, navigate]);

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 border-b border-border bg-background/80 backdrop-blur-groove px-3 sm:px-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => window.history.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button 
          onClick={() => window.history.forward()}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xs sm:max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("topbar.searchPlaceholder")}
            className="pl-10 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full h-9 sm:h-10 text-sm"
          />
        </div>
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {!user && !loading && (
          <Button 
            onClick={() => navigate("/auth")}
            variant="outline"
            size="sm"
            className="gap-2 rounded-full px-4"
          >
            <User className="h-4 w-4" />
            {t("topbar.signIn")}
          </Button>
        )}

        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="flex h-9 items-center gap-1.5 rounded-full bg-secondary/80 border border-border px-3 hover:bg-muted transition-colors text-sm font-medium"
            >
              <span className="text-lg leading-none">{languageFlags[language]}</span>
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              <Globe className="h-3 w-3 inline mr-1" />
              Language / Język
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(languageNames) as Language[]).map((lang) => (
              <DropdownMenuItem
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`cursor-pointer gap-3 ${language === lang ? "bg-primary/10 text-primary font-semibold" : ""}`}
              >
                <span className="text-lg">{languageFlags[lang]}</span>
                <span>{languageNames[lang]}</span>
                {language === lang && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="hidden sm:block">
          <Button 
            variant="outline" 
            size="sm"
            className="groove-gradient-border hover:bg-muted gap-2 rounded-full px-4"
            onClick={() => setShowUpgrade(true)}
          >
            <Crown className="h-4 w-4 text-primary" />
            <span className="groove-gradient-text font-semibold">{t("topbar.upgrade")}</span>
          </Button>
        </motion.div>

        {/* Notifications */}
        <DropdownMenu onOpenChange={(o) => o && markAllSeen()}>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary hover:bg-muted transition-colors">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center shadow-[0_0_10px_hsl(var(--primary)/0.6)] animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px] max-h-[480px] overflow-y-auto">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{t("topbar.notifications")}</span>
              {items.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-normal">ostatnie 7 dni</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-muted-foreground">
                Brak nowych aktywności.<br />
                <span className="text-xs">Wszystko cicho — wracaj za chwilę 🌙</span>
              </div>
            ) : (
              items.map((it) => {
                const Icon = ICONS[it.icon];
                return (
                  <DropdownMenuItem
                    key={it.id}
                    className="flex items-start gap-2.5 py-2.5 cursor-pointer"
                    onClick={() => it.href && navigate(it.href)}
                  >
                    <div className="mt-0.5 shrink-0 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium truncate">{it.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{since(it.ts)}</span>
                      </div>
                      {it.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{it.body}</p>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full overflow-visible groove-gradient-bg hover:opacity-90 transition-opacity">
              {user ? (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="groove-gradient-bg text-primary-foreground font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 border-2 border-background">
                    <Power className="h-2.5 w-2.5 text-white" />
                  </span>
                </>
              ) : (
                <User className="h-5 w-5 text-primary-foreground" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user ? (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500" />
                      {t("topbar.loggedIn")}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  {t("topbar.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/library")} className="cursor-pointer">
                  <Library className="mr-2 h-4 w-4" />
                  {t("topbar.yourLibrary")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/liked")} className="cursor-pointer">
                  <Heart className="mr-2 h-4 w-4" />
                  {t("topbar.likedSongs")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/my-tracks")} className="cursor-pointer">
                  <Music className="mr-2 h-4 w-4" />
                  {t("topbar.myTracks")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {t("topbar.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/ai-dj")} className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("topbar.aiPreferences")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("topbar.signOut")}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>{t("topbar.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/auth")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  {t("topbar.signIn")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")} className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("topbar.createAccount")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </header>
  );
};
