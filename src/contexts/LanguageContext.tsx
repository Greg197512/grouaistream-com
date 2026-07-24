import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Language, languageNames, languageFlags, pl, type TranslationKeys } from "@/i18n/translations";

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

  const setLanguage = (lang: Language) => {
    const prevLang = language;
    setLanguageState(lang);
    localStorage.setItem("grooveai-language", lang);
    document.documentElement.lang = lang === "ua" ? "uk" : lang;
    // Dispatch custom event so PlayerContext can react
    if (prevLang !== lang) {
      window.dispatchEvent(new CustomEvent("grooveai-language-change", { detail: { language: lang } }));
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === "ua" ? "uk" : language;
  }, []);

  const t = (key: string): string => {
    return (dict as any)[key] || (pl as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames, languageFlags }}>
      {children}
    </LanguageContext.Provider>
  );
};
