import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Bell, 
  User,
  Crown,
  LogOut,
  Settings,
  Sparkles,
  UserCircle,
  Heart,
  Library,
  Power
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const TopBar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNotifications, setHasNotifications] = useState(true);
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
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

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const getUserDisplayName = () => {
    return user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-groove px-6">
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
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="pl-10 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary rounded-full h-10"
          />
        </div>
      </form>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {!user && !loading && (
          <Button 
            onClick={() => navigate("/auth")}
            variant="outline"
            size="sm"
            className="gap-2 rounded-full px-4"
          >
            <User className="h-4 w-4" />
            Sign In
          </Button>
        )}

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button 
            variant="outline" 
            size="sm"
            className="groove-gradient-border hover:bg-muted gap-2 rounded-full px-4"
          >
            <Crown className="h-4 w-4 text-primary" />
            <span className="groove-gradient-text font-semibold">Upgrade</span>
          </Button>
        </motion.div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary hover:bg-muted transition-colors">
              <Bell className="h-5 w-5" />
              {hasNotifications && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="flex flex-col items-start gap-1 py-3 cursor-pointer"
              onClick={() => setHasNotifications(false)}
            >
              <p className="font-medium">Your AI DJ is ready!</p>
              <p className="text-xs text-muted-foreground">Based on your mood, we've created a personalized playlist</p>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 py-3 cursor-pointer">
              <p className="font-medium">New tracks added!</p>
              <p className="text-xs text-muted-foreground">Check out new Rock, Punk, and Pop hits</p>
            </DropdownMenuItem>
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
                  {/* Green dot with power icon */}
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
                      Zalogowany
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/library")} className="cursor-pointer">
                  <Library className="mr-2 h-4 w-4" />
                  Your Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/liked")} className="cursor-pointer">
                  <Heart className="mr-2 h-4 w-4" />
                  Liked Songs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/ai-dj")} className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Preferences
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/auth")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Sign In
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/auth")} className="cursor-pointer">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Account
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
