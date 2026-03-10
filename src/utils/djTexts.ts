/**
 * Localized DJ announcements for all supported languages.
 * Used by AI DJ mode for intros, transitions, and outros.
 */

export type DJLanguage = "pl" | "en" | "nl" | "ua";

export interface DJTexts {
  intros: Record<string, string[]>;
  transitions: string[];
  outros: string[];
  crowdReactions: Record<string, string[]>;
  trackAnnounce: (title: string, artist: string) => string;
  setStart: (count: number, genres: string) => string;
}

const DJ_TEXTS: Record<DJLanguage, DJTexts> = {
  pl: {
    intros: {
      default: [
        "DJ GrooveAI na konsolecie! Zaczynamy imprezę!",
        "Hej, hej! DJ GrooveAI wchodzi na scenę! Gotowi na niezapomnianą noc?",
        "Uwaga, uwaga! DJ GrooveAI przejmuje kontrolę! Trzymajcie się mocno!",
        "Witajcie w klubie GrooveAI! Dzisiejszy set będzie legendarny!",
      ],
      techno: [
        "Boom boom boom! DJ GrooveAI startuje set techno! Bas wchodzi twardy!",
        "Witamy w podziemnym klubie! DJ GrooveAI rozkręca techno session!",
        "Uwaga techno heads! DJ GrooveAI odpala maszynę! Czujecie ten bas?",
      ],
      house: [
        "Welcome to the house! DJ GrooveAI na decku! Feel the groove!",
        "House music all night long! DJ GrooveAI zaczyna set!",
        "Deep house vibes! DJ GrooveAI zabiera was w podróż muzyczną!",
      ],
      "hip-hop": [
        "Yo yo yo! DJ GrooveAI in da house! Czas na hiphopową jazdę!",
        "Reprezentuj! DJ GrooveAI na bicie! Zaczynamy!",
        "Hip hop don't stop! DJ GrooveAI puszcza najlepsze bity!",
      ],
      rock: [
        "Rock and roll! DJ GrooveAI odpala rockową maszynę!",
        "Gitara, bas, bębny! DJ GrooveAI startuje rockowy set!",
      ],
      party: [
        "Party time! DJ GrooveAI rozkręca domówkę na maksa!",
        "Hej ekipa! DJ GrooveAI puszcza największe hity na domówkę!",
        "Domówka roku zaczyna się teraz! DJ GrooveAI na konsoli!",
      ],
    },
    transitions: [
      "A teraz coś jeszcze lepszego!",
      "Nie zwalniamy tempa! Następny banger!",
      "Uwaga, zmiana! Wchodzi kolejny hit!",
      "Czujecie ten vibe? Lecimy dalej!",
      "DJ GrooveAI przełącza na kolejny level!",
      "Energia na maksa! Oto następny kawałek!",
      "Idziemy wyżej! Kolejny track!",
      "Bez przerwy! Następny w kolejce!",
      "Trzymajcie się! To dopiero początek!",
      "Feel the bass! Kolejny utwór wchodzi!",
      "Uwaga drop! Zmieniam na coś ostrzejszego!",
      "Czas na zmianę klimatu! Wchodzi nowy hit!",
      "Kto chce więcej? Dostaniecie więcej!",
    ],
    outros: [
      "To był DJ GrooveAI! Dzięki za wspólną zabawę! Do następnego razu!",
      "DJ GrooveAI kończy set! Było gorąco! Peace!",
      "Koniec setu! DJ GrooveAI dziękuje! Było mega!",
      "To wszystko na dziś! DJ GrooveAI mówi dobranoc! Było epicko!",
    ],
    crowdReactions: {
      peak: [
        "Widzę, że publiczność szaleje! Dokręcam basy!",
        "Energia na maksa! Nie zwalniamy!",
        "Tłum daje czadu! Lecimy z bangerami!",
      ],
      high: [
        "Dobra energia na parkiecie! Trzymamy poziom!",
        "Widzę uśmiechy! Kontynuujemy w tym stylu!",
      ],
      medium: [
        "Hmm, trzeba trochę rozkręcić tłum! Zmieniam styl!",
        "Widzę, że potrzebujemy zmiany! Wchodzę z czymś mocniejszym!",
      ],
      low: [
        "Spokojny vibe! Dajmy chwilę na oddech!",
        "Widzę, że ludzie chillują! Lecę z czymś relaksowym!",
      ],
    },
    trackAnnounce: (title, artist) => `${title} od ${artist}!`,
    setStart: (count, genres) => `Mam dla was ${count} kawałków! ${genres ? `Lecimy w stylu ${genres}!` : "Mieszanka najlepszych hitów!"}`,
  },

  en: {
    intros: {
      default: [
        "DJ GrooveAI on the decks! Let's get this party started!",
        "Hey hey! DJ GrooveAI is in the building! Ready for an unforgettable night?",
        "Attention! DJ GrooveAI is taking control! Hold on tight!",
        "Welcome to Club GrooveAI! Tonight's set will be legendary!",
      ],
      techno: [
        "Boom boom boom! DJ GrooveAI kicks off a techno set! The bass hits hard!",
        "Welcome to the underground! DJ GrooveAI fires up the techno session!",
        "Techno heads unite! DJ GrooveAI starts the machine! Feel that bass?",
      ],
      house: [
        "Welcome to the house! DJ GrooveAI on the deck! Feel the groove!",
        "House music all night long! DJ GrooveAI begins the set!",
        "Deep house vibes! DJ GrooveAI takes you on a musical journey!",
      ],
      "hip-hop": [
        "Yo yo yo! DJ GrooveAI in da house! Time for a hip-hop ride!",
        "Represent! DJ GrooveAI on the beat! Let's go!",
        "Hip hop don't stop! DJ GrooveAI drops the best beats!",
      ],
      rock: [
        "Rock and roll! DJ GrooveAI fires up the rock machine!",
        "Guitar, bass, drums! DJ GrooveAI starts the rock set!",
      ],
      party: [
        "Party time! DJ GrooveAI cranks the party to the max!",
        "Hey crew! DJ GrooveAI plays the biggest party hits!",
        "Party of the year starts now! DJ GrooveAI on the console!",
      ],
    },
    transitions: [
      "And now something even better!",
      "We're not slowing down! Next banger coming up!",
      "Watch out, change incoming! Another hit drops!",
      "Feel that vibe? Let's keep going!",
      "DJ GrooveAI switches to the next level!",
      "Energy at maximum! Here comes the next track!",
      "Going higher! Next one up!",
      "No breaks! Next in the queue!",
      "Hold on! This is just the beginning!",
      "Feel the bass! Next track incoming!",
      "Drop alert! Switching to something harder!",
      "Time for a mood change! New hit incoming!",
      "Who wants more? You'll get more!",
    ],
    outros: [
      "That was DJ GrooveAI! Thanks for the party! Until next time!",
      "DJ GrooveAI ends the set! It was fire! Peace!",
      "Set complete! DJ GrooveAI says thank you! That was epic!",
      "That's all for tonight! DJ GrooveAI says goodnight! What a ride!",
    ],
    crowdReactions: {
      peak: [
        "The crowd is going wild! Turning up the bass!",
        "Energy at maximum! We're not stopping!",
        "The crowd is on fire! Dropping bangers!",
      ],
      high: [
        "Great energy on the floor! Keeping it up!",
        "I see smiles! Continuing this style!",
      ],
      medium: [
        "Hmm, need to pump up the crowd! Changing style!",
        "I see we need a change! Coming in with something harder!",
      ],
      low: [
        "Chill vibes! Let's take a moment to breathe!",
        "I see people are chilling! Going with something relaxing!",
      ],
    },
    trackAnnounce: (title, artist) => `${title} by ${artist}!`,
    setStart: (count, genres) => `I've got ${count} tracks for you! ${genres ? `We're going ${genres} style!` : "A mix of the best hits!"}`,
  },

  nl: {
    intros: {
      default: [
        "DJ GrooveAI achter de draaitafel! Laten we dit feest starten!",
        "Hey hey! DJ GrooveAI is in het gebouw! Klaar voor een onvergetelijke nacht?",
        "Let op! DJ GrooveAI neemt de controle over! Hou je vast!",
        "Welkom bij Club GrooveAI! De set van vanavond wordt legendarisch!",
      ],
      techno: [
        "Boem boem boem! DJ GrooveAI start een techno set! De bas komt hard binnen!",
        "Welkom in de underground! DJ GrooveAI start de techno sessie!",
      ],
      house: [
        "Welkom in het huis! DJ GrooveAI op het dek! Voel de groove!",
        "House muziek de hele nacht! DJ GrooveAI begint de set!",
      ],
      "hip-hop": [
        "Yo yo yo! DJ GrooveAI in da house! Tijd voor een hiphop rit!",
        "DJ GrooveAI op de beat! We gaan!",
      ],
      rock: [
        "Rock and roll! DJ GrooveAI start de rockmachine!",
      ],
      party: [
        "Feesttijd! DJ GrooveAI draait het feest op volle kracht!",
        "Hey crew! DJ GrooveAI draait de grootste feesthits!",
      ],
    },
    transitions: [
      "En nu iets nog beters!",
      "We stoppen niet! Volgende banger komt eraan!",
      "Let op, verandering! Nog een hit komt eraan!",
      "Voel je die vibe? We gaan verder!",
      "DJ GrooveAI schakelt naar het volgende level!",
      "Energie op maximum! Hier komt het volgende nummer!",
      "We gaan hoger! Volgende track!",
      "Geen pauzes! Volgende in de rij!",
      "Hou je vast! Dit is nog maar het begin!",
      "Voel de bas! Volgend nummer komt eraan!",
    ],
    outros: [
      "Dat was DJ GrooveAI! Bedankt voor het feest! Tot de volgende keer!",
      "DJ GrooveAI beëindigt de set! Het was geweldig! Peace!",
      "Set klaar! DJ GrooveAI zegt bedankt! Dat was episch!",
    ],
    crowdReactions: {
      peak: [
        "Het publiek gaat wild! Bas omhoog!",
        "Energie op maximum! We stoppen niet!",
      ],
      high: [
        "Geweldige energie op de vloer! We houden het vol!",
        "Ik zie lachende gezichten! We gaan door!",
      ],
      medium: [
        "Hmm, we moeten het publiek opwarmen! Stijl veranderen!",
      ],
      low: [
        "Chill vibes! Even adempauze!",
        "Mensen chillen! Iets rustigs komend!",
      ],
    },
    trackAnnounce: (title, artist) => `${title} van ${artist}!`,
    setStart: (count, genres) => `Ik heb ${count} nummers voor jullie! ${genres ? `We gaan ${genres} stijl!` : "Een mix van de beste hits!"}`,
  },

  ua: {
    intros: {
      default: [
        "DJ GrooveAI за пультом! Починаємо вечірку!",
        "Гей гей! DJ GrooveAI виходить на сцену! Готові до незабутньої ночі?",
        "Увага! DJ GrooveAI бере контроль! Тримайтесь міцно!",
        "Ласкаво просимо до клубу GrooveAI! Сьогоднішній сет буде легендарним!",
      ],
      techno: [
        "Бум бум бум! DJ GrooveAI стартує техно сет! Бас заходить жорстко!",
        "Вітаємо в андерграунді! DJ GrooveAI розкручує техно сесію!",
      ],
      house: [
        "Welcome to the house! DJ GrooveAI на деку! Відчуйте грув!",
        "House музика всю ніч! DJ GrooveAI починає сет!",
      ],
      "hip-hop": [
        "Йо йо йо! DJ GrooveAI ін да хаус! Час для хіп-хоп їзди!",
        "DJ GrooveAI на біті! Поїхали!",
      ],
      rock: [
        "Рок-н-рол! DJ GrooveAI запускає рок-машину!",
      ],
      party: [
        "Час вечірки! DJ GrooveAI розкручує тусу на максимум!",
        "Гей команда! DJ GrooveAI грає найбільші хіти!",
      ],
    },
    transitions: [
      "А тепер щось ще краще!",
      "Не зупиняємось! Наступний бенгер!",
      "Увага, зміна! Заходить наступний хіт!",
      "Відчуваєте цей вайб? Летимо далі!",
      "DJ GrooveAI переключає на наступний рівень!",
      "Енергія на максимумі! Ось наступний трек!",
      "Ідемо вище! Наступний трек!",
      "Без зупинок! Наступний у черзі!",
      "Тримайтесь! Це тільки початок!",
      "Відчуйте бас! Наступний трек заходить!",
    ],
    outros: [
      "Це був DJ GrooveAI! Дякую за спільну тусу! До наступного разу!",
      "DJ GrooveAI завершує сет! Було гаряче! Мир!",
      "Сет завершено! DJ GrooveAI дякує! Було епічно!",
    ],
    crowdReactions: {
      peak: [
        "Бачу, що публіка шаленіє! Додаю басу!",
        "Енергія на максимумі! Не зупиняємось!",
      ],
      high: [
        "Чудова енергія на танцполі! Тримаємо рівень!",
        "Бачу усмішки! Продовжуємо в цьому стилі!",
      ],
      medium: [
        "Хмм, треба розкрутити натовп! Змінюю стиль!",
      ],
      low: [
        "Спокійний вайб! Дамо хвилинку на подих!",
        "Бачу, що люди чилять! Лечу з чимось релаксовим!",
      ],
    },
    trackAnnounce: (title, artist) => `${title} від ${artist}!`,
    setStart: (count, genres) => `Маю для вас ${count} треків! ${genres ? `Летимо в стилі ${genres}!` : "Мікс найкращих хітів!"}`,
  },
};

export const getDJTexts = (lang: DJLanguage): DJTexts => {
  return DJ_TEXTS[lang] || DJ_TEXTS.en;
};

export const getDJLangFromAppLang = (appLang: string): DJLanguage => {
  if (["pl", "en", "nl", "ua"].includes(appLang)) return appLang as DJLanguage;
  return "en";
};

/** Get TTS language code from app language */
export const getDJTTSLang = (lang: DJLanguage): string => {
  const map: Record<DJLanguage, string> = {
    pl: "pl-PL",
    en: "en-US",
    nl: "nl-NL",
    ua: "uk-UA",
  };
  return map[lang] || "en-US";
};
