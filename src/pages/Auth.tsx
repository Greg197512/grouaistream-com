import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff, Sparkles, ShieldCheck, HeartHandshake, Radio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { AuroraBackground } from "@/components/effects/AuroraBackground";
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          // Pozwól wybrać konto Google zamiast auto-logowania ostatnim.
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) {
        // Najczęstsza przyczyna: provider Google nie włączony w Supabase Auth
        // albo URL powrotny nie jest na whiteliście (Auth → URL Configuration).
        toast.error(error.message || "Nie udało się zalogować przez Google");
        setGoogleLoading(false);
        return;
      }
      // Sukces = przeglądarka przekierowuje do Google (nie resetujemy loadera).
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

  const features = [
    { icon: ShieldCheck, title: "Prawdziwe odsłuchy", desc: "Zero botów. Artyści zarabiają tylko od realnych fanów." },
    { icon: Sparkles, title: "AI, które rozumie nastrój", desc: "Playlisty dopasowane do Twojego rytmu i emocji." },
    { icon: HeartHandshake, title: "Zarabiaj z nami", desc: "Uczciwy podział — Twoja muzyka, Twoje pieniądze." },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-foreground">
      {/* Tło: aurora + pomarańczowy blask */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 opacity-60 mix-blend-screen"><AuroraBackground /></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(24_100%_55%/0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(38_100%_50%/0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background/85" />
      </div>

      <button
        onClick={() => navigate("/")}
        className="absolute top-5 left-5 z-20 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backHome")}
      </button>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* LEWA — showcase marki (desktop) */}
        <div className="hidden lg:flex flex-col justify-center px-14 xl:px-20">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img src="/logo-icon.png" alt="GrouAI Stream" className="h-16 w-16 mb-6 drop-shadow-[0_0_20px_hsl(24_100%_55%/0.5)]" />
            <h1 className="text-5xl xl:text-6xl font-bold leading-tight mb-4">
              <span className="bg-gradient-to-br from-orange-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                Muzyka, która<br />rozumie Ciebie.
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mb-10">
              Dołącz do GrouAI Stream — streaming z AI, uczciwe zarobki dla artystów i radio 24/7.
            </p>

            <div className="space-y-5 max-w-md">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.12 }}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[hsl(28_100%_55%/0.12)] border border-[hsl(32_100%_60%/0.35)] backdrop-blur-sm shadow-[inset_0_1px_0_hsl(44_100%_82%/0.4)]">
                    <f.icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{f.title}</p>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* PRAWA — karta logowania (szkło) */}
        <div className="flex items-center justify-center px-4 py-14">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            {/* Poświata pod kartą */}
            <div className="relative">
              <div className="absolute -inset-[2px] rounded-3xl bg-gradient-to-br from-orange-400/40 via-amber-500/30 to-orange-600/40 opacity-60 blur-xl" />
              <div className="relative rounded-3xl border border-[hsl(32_100%_60%/0.35)] bg-card/70 backdrop-blur-2xl p-8 shadow-[0_8px_40px_hsl(24_100%_50%/0.25),inset_0_1px_0_hsl(44_100%_82%/0.25)]">
                <div className="flex flex-col items-center mb-7 lg:hidden">
                  <img src="/logo-icon.png" alt="GrouAI Stream" className="h-14 w-14 mb-3" />
                </div>

                <h2 className="text-2xl font-bold text-center mb-1">
                  {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-7">
                  {isLogin ? "Zaloguj się, żeby słuchać dalej." : "Załóż konto w 30 sekund."}
                </p>

                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full mb-5 h-11 bg-white text-[#1f1f1f] hover:bg-white/90 font-medium shadow-lg rounded-xl"
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {googleLoading ? "Łączenie z Google…" : "Kontynuuj z Google"}
                </Button>

                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/70 px-3 text-muted-foreground backdrop-blur">lub email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence initial={false}>
                    {!isLogin && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        <Label htmlFor="displayName">{t("auth.nickLabel")}</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="displayName"
                            type="text"
                            placeholder={t("auth.nickPlaceholder")}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            minLength={2}
                            className="pl-10 h-11 rounded-xl bg-background/50 border-border focus:border-orange-400/60"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                        className="pl-10 h-11 rounded-xl bg-background/50 border-border focus:border-orange-400/60"
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
                        className="pl-10 pr-10 h-11 rounded-xl bg-background/50 border-border focus:border-orange-400/60"
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
                    className="w-full h-11 groove-gradient-bg text-primary-foreground hover:opacity-90 rounded-xl font-semibold shadow-[0_6px_24px_hsl(24_100%_50%/0.4)]"
                  >
                    {loading ? t("auth.loading") : isLogin ? t("auth.signIn") : t("auth.signUp")}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-sm text-muted-foreground hover:text-orange-300 transition-colors"
                  >
                    {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
                  </button>
                </div>

                <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-muted-foreground/60 tracking-wide">
                  <Radio className="h-3 w-3" /> by GrouaRock
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
