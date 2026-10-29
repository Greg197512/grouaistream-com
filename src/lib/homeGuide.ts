// Instrukcja „Jak zacząć” na stronie głównej, w czterech językach.
export type GuideLang = "PL" | "EN" | "NL" | "UA";

export type HomeGuide = {
  title: string;
  steps: string[];
  film: string;
  filmTitle: string;
};

export const HOME_GUIDE: Record<GuideLang, HomeGuide> = {
  PL: {
    title: "Jak zacząć",
    steps: [
      "Wejdź na grouaistream.com.",
      "Zaloguj się. Bez logowania generator jest zablokowany.",
      "Otwórz GrouAI Studio z dolnego menu.",
      "Opisz utwór jednym zdaniem: styl, długość, wokal.",
      "Kliknij Generuj. Resztą zajmuje się AI.",
    ],
    film: "Odtwórz film informacyjny",
    filmTitle: "GrouAI Stream: film informacyjny",
  },
  EN: {
    title: "Get started",
    steps: [
      "Go to grouaistream.com.",
      "Log in. The generator is locked until you log in.",
      "Open GrouAI Studio from the bottom menu.",
      "Describe a track in one sentence: style, length, vocals.",
      "Click Generate. AI takes care of the rest.",
    ],
    film: "Watch the info video",
    filmTitle: "GrouAI Stream: info video",
  },
  NL: {
    title: "Aan de slag",
    steps: [
      "Ga naar grouaistream.com.",
      "Log in. Zonder inloggen is de generator vergrendeld.",
      "Open GrouAI Studio in het menu onderaan.",
      "Beschrijf een nummer in één zin: stijl, lengte, zang.",
      "Klik op Genereer. De AI doet de rest.",
    ],
    film: "Bekijk de infovideo",
    filmTitle: "GrouAI Stream: infovideo",
  },
  UA: {
    title: "Як почати",
    steps: [
      "Перейдіть на grouaistream.com.",
      "Увійдіть. Без входу генератор заблокований.",
      "Відкрийте GrouAI Studio у нижньому меню.",
      "Опишіть трек одним реченням: стиль, тривалість, вокал.",
      "Натисніть «Згенерувати». Решту робить ШІ.",
    ],
    film: "Переглянути інформаційне відео",
    filmTitle: "GrouAI Stream: інформаційне відео",
  },
};
