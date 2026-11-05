import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { Language, languageNames, languageFlags, pl, type TranslationKeys } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";

// Polski jest w głównym bundlu (domyślny + fallback). Pozostałe języki
// ładują się dynamicznie jako osobne chunki dopiero, gdy są potrzebne —
// to zdejmuje ~200 KB z krytycznej ścieżki ładowania strony.
const dictLoaders: Record<Exclude<Language, "pl">, () => Promise<{ default: TranslationKeys }>> = {
  en: () => import("@/i18n/en"),
  nl: () => import("@/i18n/nl"),
  ua: () => import("@/i18n/ua"),
};

const dictCache: Partial<Record<Language, TranslationKeys>> = { pl };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  languageNames: typeof languageNames;
  languageFlags: typeof languageFlags;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("grooveai-language");
    if (saved && ["pl", "en", "nl", "ua"].includes(saved)) {
      return saved as Language;
    }
    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith("pl")) return "pl";
    if (browserLang.startsWith("nl")) return "nl";
    if (browserLang.startsWith("uk")) return "ua";
    return "en";
  });

  const [dict, setDict] = useState<TranslationKeys>(() => dictCache[language] ?? pl);

  useEffect(() => {
    let cancelled = false;
    const cached = dictCache[language];
    if (cached) {
      setDict(cached);
      return;
    }
    dictLoaders[language as Exclude<Language, "pl">]()
      .then((mod) => {
        dictCache[language] = mod.default;
        if (!cancelled) setDict(mod.default);
      })
      .catch(() => {
        // Chunk się nie wczytał (np. offline) — zostaje polski fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = (lang: Language, fromAccount = false) => {
    const prevLang = language;
    setLanguageState(lang);
    localStorage.setItem("grooveai-language", lang);
    // Zalogowany: zapisz wybór na koncie (metadane użytkownika), żeby działał na każdym urządzeniu.
    if (!fromAccount) {
      supabase.auth.getSession().then(({ data }) => {
        const u = data.session?.user;
        if (u && u.user_metadata?.language !== lang) supabase.auth.updateUser({ data: { language: lang } }).catch(() => {});
      }).catch(() => {});
    }
    document.documentElement.lang = lang === "ua" ? "uk" : lang;
    // Dispatch custom event so PlayerContext can react
    if (prevLang !== lang) {
      window.dispatchEvent(new CustomEvent("grooveai-language-change", { detail: { language: lang } }));
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === "ua" ? "uk" : language;
  }, []);

  // Po zalogowaniu weź język zapisany na koncie (wybrany wcześniej przez tę osobę).
  useEffect(() => {
    const apply = (meta: Record<string, unknown> | undefined) => {
      const l = meta?.language;
      if (typeof l === "string" && ["pl", "en", "nl", "ua"].includes(l)) {
        setLanguageRef.current(l as Language, true);
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user?.user_metadata)).catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") apply(session?.user?.user_metadata);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const setLanguageRef = useRef(setLanguage);
  setLanguageRef.current = setLanguage;

  const t = (key: string): string => {
    return (dict as any)[key] || (pl as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames, languageFlags }}>
      {children}
    </LanguageContext.Provider>
  );
};
