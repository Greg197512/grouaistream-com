import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const Auth = () => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Nie udało się zalogować przez Google");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success("Zalogowano przez Google");
      navigate("/");
    } catch (e: any) {
      toast.error(e?.message || "Błąd logowania Google");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(error.message || "Failed to sign in");
        } else {
          toast.success(t("auth.welcomeBackMsg"));
          navigate("/");
        }
      } else {
        if (!displayName.trim() || displayName.trim().length < 2) {
          toast.error(t("auth.nickMinError"));
          setLoading(false);
          return;
        }
        const { error } = await signUp(email, password, displayName.trim());
        if (error) {
          toast.error(error.message || "Failed to sign up");
        } else {
          toast.success(t("auth.accountCreated"));
          setIsLogin(true);
        }
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="groove-card p-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("auth.backHome")}
          </button>

          <div className="flex flex-col items-center mb-8">
            <img src="/logo-icon.png" alt="GrouAI Stream" className="h-16 w-16 mb-4" />
            <h1 className="font-display text-2xl font-bold groove-gradient-text">
              GrouAI Stream
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("auth.nickLabel")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder={t("auth.nickPlaceholder")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    minLength={2}
                    className="pl-10"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70">
                  {t("auth.nickHint")}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.emailLabel")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.passwordLabel")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full groove-gradient-bg text-primary-foreground hover:opacity-90"
            >
              {loading ? t("auth.loading") : isLogin ? t("auth.signIn") : t("auth.signUp")}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
            </button>
          </div>

          <p className="mt-4 text-center text-[10px] text-muted-foreground/60 tracking-wide">
            by Karon
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
