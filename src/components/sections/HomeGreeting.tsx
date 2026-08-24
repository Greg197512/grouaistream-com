import { useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

// Powitanie + chipsy kategorii — wizualny element w stylu referencyjnych
// mockupów (Hi, … / All · Pop · Hip-Hop). Nie zmienia logiki strony:
// chip przenosi do wyszukiwania danego gatunku.
export const HomeGreeting = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const L = (pl: string, en: string, nl: string, ua: string) =>
    language === "en" ? en : language === "nl" ? nl : language === "ua" ? ua : pl;

  const hour = new Date().getHours();
  const greet =
    hour < 12
      ? L("Dzień dobry", "Good morning", "Goedemorgen", "Доброго ранку")
      : hour < 18
      ? L("Dzień dobry", "Good afternoon", "Goedemiddag", "Доброго дня")
      : L("Dobry wieczór", "Good evening", "Goedenavond", "Добрий вечір");

  const name =
    profile?.displayName ||
    (user?.email ? user.email.split("@")[0] : "") ||
    L("melomanie", "music lover", "muziekliefhebber", "меломане");

  const forYou = L("Dla Ciebie", "For You", "Voor jou", "Для тебе");
  const chips = [forYou, "Pop", "Hip-Hop", "Rock", "Electronic", "Chill", "GROUA ERA"];
  const [active, setActive] = useState(forYou);

  const onChip = (c: string) => {
    setActive(c);
    if (c === forYou) return;
    if (c === "GROUA ERA") { navigate("/era"); return; }
    navigate(`/search?q=${encodeURIComponent(c)}`);
  };

  return (
    <section className="px-4 sm:px-6 pt-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] tracking-[.2em] uppercase font-semibold text-primary/90">{greet}</p>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-0.5">
            {L("Cześć", "Hi", "Hoi", "Привіт")}, {name} 👋
          </h2>
        </div>
        <button
          aria-label={L("Powiadomienia", "Notifications", "Meldingen", "Сповіщення")}
          onClick={() => navigate(user ? "/settings" : "/auth")}
          className="h-10 w-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/80 hover:text-white hover:border-primary/40 transition-colors"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mt-3" style={{ scrollbarWidth: "none" }}>
        {chips.map((c) => {
          const on = c === active;
          return (
            <button
              key={c}
              onClick={() => onChip(c)}
              className={
                "flex-none px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all " +
                (on
                  ? "text-white border border-transparent groove-gradient-bg shadow-[0_8px_20px_-8px_hsl(331_100%_62%/0.6)]"
                  : "text-muted-foreground border border-white/10 bg-white/[0.03] hover:border-primary/30 hover:text-white")
              }
            >
              {c}
            </button>
          );
        })}
      </div>
    </section>
  );
};
