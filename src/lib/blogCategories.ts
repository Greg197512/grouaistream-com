// Centralized blog category labels — multilingual.
// Used by BlogIndex (filter chips), BlogPost & RelatedPosts (badges).

export type BlogCategoryLabel = { pl: string; en: string; nl: string; ua: string };

export const BLOG_CATEGORIES: { id: string; label: BlogCategoryLabel }[] = [
  { id: "all",              label: { pl: "Wszystkie",          en: "All",                 nl: "Alles",               ua: "Усі" } },
  { id: "sound_chronicles", label: { pl: "🎼 Kroniki Dźwięku", en: "🎼 Sound Chronicles", nl: "🎼 Geluidskronieken", ua: "🎼 Хроніки Звуку" } },
  { id: "music_stories",    label: { pl: "🎹 Historie muz.",   en: "🎹 Music stories",    nl: "🎹 Muziekverhalen",   ua: "🎹 Музичні історії" } },
  { id: "ai_news",          label: { pl: "🔥 AI News",         en: "🔥 AI News",          nl: "🔥 AI Nieuws",        ua: "🔥 AI Новини" } },
  { id: "tech_news",        label: { pl: "💻 Tech",            en: "💻 Tech",             nl: "💻 Tech",             ua: "💻 Tech" } },
  { id: "trends",           label: { pl: "Trendy",             en: "Trends",              nl: "Trends",              ua: "Тренди" } },
  { id: "feature",          label: { pl: "Funkcje",            en: "Features",            nl: "Functies",            ua: "Функції" } },
  { id: "monetization",     label: { pl: "Zarobki",            en: "Earnings",            nl: "Verdienen",           ua: "Заробіток" } },
  { id: "tutorial",         label: { pl: "Tutoriale",          en: "Tutorials",           nl: "Tutorials",           ua: "Туторіали" } },
  { id: "psychology",       label: { pl: "Psychologia",        en: "Psychology",          nl: "Psychologie",         ua: "Психологія" } },
  { id: "tools",            label: { pl: "Narzędzia",          en: "Tools",               nl: "Tools",               ua: "Інструменти" } },
  { id: "industry",         label: { pl: "Branża",             en: "Industry",            nl: "Industrie",           ua: "Індустрія" } },
];

export const getCategoryLabel = (id: string, lang: string): string => {
  const c = BLOG_CATEGORIES.find((x) => x.id === id);
  if (!c) return id;
  return (c.label as any)[lang] || c.label.pl;
};
