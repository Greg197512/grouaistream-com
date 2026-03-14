import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { Language, translations, languageNames, languageFlags } from "@/i18n/translations";

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
    const trans = translations[language];
    return (trans as any)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, languageNames, languageFlags }}>
      {children}
    </LanguageContext.Provider>
  );
};
