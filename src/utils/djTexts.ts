/**
 * Professional DJ announcements — Rotterdam/Dutch peak-time hard techno style.
 * Raw, driving, dark, high-energy underground club/domówka vibes.
 * No mainstream, no vocals unless requested. 130-132 BPM default energy.
 * 
 * Authentic club DJ callouts in 4 languages (PL, EN, NL, UA).
 */

export type DJLanguage = "pl" | "en" | "nl" | "ua";

export interface DJTexts {
  intros: Record<string, string[]>;
  transitions: string[];
  outros: string[];
  crowdReactions: Record<string, string[]>;
  trackAnnounce: (title: string, artist: string) => string;
  setStart: (count: number, genres: string) => string;
  hypeLines: string[];
  dropLines: string[];
  mixLines: string[];
}

const DJ_TEXTS: Record<DJLanguage, DJTexts> = {
  pl: {
    intros: {
      default: [
        "UWAGA! DJ GrooveAI wchodzi na konsole! Rotterdam style! Twardy bas, ciemne synthy, sto trzydzieści BPM! NIE MA LITOŚCI! LECIMY!",
        "DJ GrooveAI za sterami! Peak time! Hard techno prosto z Rotterdamu! Czujecie ten kick w żołądku? To dopiero POCZĄTEK!",
        "Ej! DJ GrooveAI odpala darkroom! Twardy, surowy, bez kompromisów! Kto jest gotowy na DEMOLKĘ?! TRZY DWA JEDEN GO!",
        "DJ GrooveAI przejmuje parkiet! Dutch hard techno! Ciężki kick, sub-bas do kości! Zamknijcie oczy i CZUJCIE TEN BEAT!",
      ],
      techno: [
        "BOOM! DJ GrooveAI! Peak-time hard techno z Rotterdamu! Sto trzydzieści BPM, twardy kick, ciemne synthy! CZUJECIE TEN BAS?! LECIMY NA MAKSA!",
        "Welcome to the UNDERGROUND! DJ GrooveAI odpala Rotterdam techno! Raw, driving, bez litości! Darkroom ACTIVATED!",
        "Techno warriors! DJ GrooveAI za konsolą! Dutch style peak hour! Dominant sub-bas plus hard kick! FEEL THE PRESSURE!",
        "UWAGA ravers! DJ GrooveAI wchodzi z CIĘŻKIM sprzętem! Rotterdam hard techno! Sto trzydzieści dwa BPM i ZERO hamulców!",
      ],
      house: [
        "DJ GrooveAI! Driving house prosto z Rotterdamu! Ciężki groove, dark bassline, raw energy! CZUJECIE TEN DRIVE?!",
        "Welcome to the HOUSE! DJ GrooveAI pushuje driving house! Dutch underground vibes! Twardy kick plus deep sub! LECIMY!",
      ],
      "hip-hop": [
        "Yo! DJ GrooveAI! Hard hitting beats Rotterdam style! Raw, ciężki, bez kompromisów! ONE TWO! LECIMY!",
      ],
      rock: [
        "DJ GrooveAI! Industrial rock meets Rotterdam techno! Surowe gitary plus hard kicks! BĘDZIE BRUTALNIE!",
      ],
      party: [
        "DJ GrooveAI odpala DOMÓWKĘ roku! Rotterdam peak-time! Hard techno plus driving house! Sąsiedzi już dzwonią po POLICJĘ ale MY SIĘ NIE ZATRZYMAMY!",
        "DOMÓWKA dwa tysiące dwadzieścia sześć! DJ GrooveAI za deckami! Dutch hard techno na MAKSA! Twardy kick, ciemny bas, ZERO chill! LECIMY DO CZERWONOŚCI!",
        "Hej ekipa! DJ GrooveAI rozkręca peak-time domówkę! Rotterdam vibes! Sto trzydzieści BPM, raw sub-bas, dark synths! KTO JEST GOTOWY?!",
      ],
      festival: [
        "MAIN STAGE! DJ GrooveAI! Rotterdam hard techno! Peak hour energy! Dziesięć tysięcy rąk w GÓRZE! TO JEST WASZ MOMENT!",
      ],
      club: [
        "DJ GrooveAI przejmuje darkroom! Rotterdam underground! Hard techno, raw driving house! Dress code: BLACK ONLY!",
      ],
    },
    transitions: [
      "Trzymajcie się! Wchodzi CIĘŻSZY kick!",
      "Nie zwalniamy! Sub-bas idzie GŁĘBIEJ!",
      "DROP za trzy dwa jeden! BOOM!",
      "Zmieniam na CIEMNIEJSZY vibe! Czujecie?!",
      "DJ GrooveAI podkręca CIŚNIENIE! Hold on!",
      "Energia ROŚNIE! Kolejny BANGER leci!",
      "Wyżej! WYŻEJ! Peak time!",
      "Bez przerwy! Bez litości! NASTĘPNY!",
      "To dopiero rozgrzewka! A teraz PRAWDZIWY ogień!",
      "Bas wchodzi TWARDSZY! CZUJECIE TO?!",
      "Heavy rotation! Zmieniam na coś co was ROZWALI!",
      "REWIND! Wchodzi świeży hard kick!",
      "Hold up! Mam coś BRUTALNEGO! Słuchajcie!",
      "Crossfade! Smooth transition into DARKNESS!",
      "Next track! Jeszcze CIEMNIEJ jeszcze TWARDZIEJ!",
    ],
    hypeLines: [
      "HANDS UP! Ręce do GÓRY!",
      "Louder! LOUDER!",
      "CZUJECIE TEN KICK?!",
      "Peak time! PEAK TIME!",
      "Skaczemy! JUMP JUMP JUMP!",
      "Dajcie mi ENERGIĘ!",
      "Rotterdam w BUDYNKU!",
      "HARDER! FASTER! DARKER!",
    ],
    dropLines: [
      "Trzy dwa jeden DROP!",
      "Wait for it. BOOM!",
      "Here comes the BASS!",
      "READY?! DROOOOP!",
      "Cisza i WYBUCH!",
      "BUILD UP! Annnd DROP!",
    ],
    mixLines: [
      "Smooth crossfade! Czujecie jak to WCHODZI?",
      "Perfekt blend! Dwa tracki jeden GROOVE!",
      "Watch the mix! SEAMLESS!",
      "EQ transition! Bass swap! CLEAN!",
    ],
    outros: [
      "DJ GrooveAI zamyka set! Rotterdam hard techno! Co za NOC! Co za ENERGIA! PEACE!",
      "To był DJ GrooveAI! Peak time DELIVERED! Dzięki za tę SESJĘ! Do zobaczenia na następnym RAVE!",
      "Last track! DJ GrooveAI mówi: byliście BRUTALNI! NAJLEPSZA publiczność! EVER!",
    ],
    crowdReactions: {
      peak: [
        "Parkiet EKSPLODUJE! Bass na MAKSA! ZERO hamulców!",
        "PEAK ENERGY! Tłum daje WSZYSTKO! I ja daję WSZYSTKO!",
        "TO JEST TEN MOMENT! Hard techno na MAKSA! LECIMY!",
      ],
      high: [
        "Dobra energia! Trzymamy to! Sub-bas TRZYMA!",
        "Parkiet się KRĘCI! Jeszcze chwila do PEAK TIME!",
      ],
      medium: [
        "Muszę was ROZKRĘCIĆ! Wchodzę z czymś TWARDSZYM!",
        "Czas na CIĘŻSZY kick! UWAGA!",
      ],
      low: [
        "Chwila na oddech! Ale zaraz wracamy z PODWÓJNĄ MOCĄ!",
        "Chill moment! Ale nie ZASYPIAJCIE! Bo za chwilę BOOM!",
      ],
    },
    trackAnnounce: (title, artist) => {
      const short = title.split(/\s+/).slice(0, 2).join(" ");
      return `${short}! SŁYSZYCIE?!`;
    },
    setStart: (count, genres) => `${count} kawałków! Jeden TWARDSZY od drugiego! ${genres ? `Styl ${genres}! TRZYMAJCIE SIĘ!` : "Peak-time hard techno! Let's GO!"}`,
  },

  en: {
    intros: {
      default: [
        "DJ GrooveAI on the DECKS! Rotterdam style! Hard kick, dark synths, one thirty BPM! NO MERCY! LET'S GO!",
        "DJ GrooveAI behind the console! Peak time hard techno straight from ROTTERDAM! Feel that kick in your GUT? We're just STARTING!",
        "Attention! DJ GrooveAI activates DARKROOM! Raw, driving, no compromises! Who's ready for DEMOLITION?! THREE TWO ONE GO!",
        "DJ GrooveAI takes the FLOOR! Dutch hard techno! Heavy kick, sub-bass to the BONE! Close your eyes and FEEL THE BEAT!",
      ],
      techno: [
        "BOOM! DJ GrooveAI! Peak-time hard techno from ROTTERDAM! One thirty BPM, hard kick, dark synths! FEEL THAT BASS?! FULL POWER!",
        "Welcome to the UNDERGROUND! DJ GrooveAI fires Rotterdam TECHNO! Raw, driving, no mercy! Darkroom ACTIVATED!",
        "Techno WARRIORS! DJ GrooveAI at the console! Dutch style peak HOUR! Dominant sub-bass plus hard KICK! FEEL THE PRESSURE!",
        "ATTENTION ravers! DJ GrooveAI enters with HEAVY artillery! Rotterdam hard techno! One thirty two BPM and ZERO brakes!",
      ],
      house: [
        "DJ GrooveAI! Driving house straight from ROTTERDAM! Heavy groove, dark bassline, raw energy! FEEL THAT DRIVE?!",
        "Welcome to the HOUSE! DJ GrooveAI pushing driving house! Dutch underground VIBES! Hard kick plus deep SUB! LET'S GO!",
      ],
      "hip-hop": [
        "DJ GrooveAI! Hard hitting beats Rotterdam STYLE! Raw, heavy, no compromises! ONE TWO! LET'S GO!",
      ],
      rock: [
        "DJ GrooveAI! Industrial rock meets Rotterdam TECHNO! Raw guitars plus hard kicks! BRUTAL!",
      ],
      party: [
        "DJ GrooveAI fires the PARTY of the year! Rotterdam PEAK-TIME! Hard techno plus driving house! Neighbors calling COPS but WE WON'T STOP!",
        "DOMÓWKA twenty twenty SIX! DJ GrooveAI on the DECKS! Dutch hard techno at FULL BLAST! Hard kick, dark bass, ZERO chill! GOING ALL OUT!",
        "Hey CREW! DJ GrooveAI cranks peak-time PARTY! Rotterdam VIBES! One thirty BPM, raw sub-bass, dark synths! WHO'S READY?!",
      ],
      festival: [
        "MAIN STAGE! DJ GrooveAI! Rotterdam hard TECHNO! Peak hour ENERGY! Ten thousand hands UP! THIS IS YOUR MOMENT!",
      ],
      club: [
        "DJ GrooveAI takes the DARKROOM! Rotterdam UNDERGROUND! Hard techno, raw driving house! Dress code: BLACK ONLY!",
      ],
    },
    transitions: [
      "Hold ON! Heavier kick INCOMING!",
      "We don't slow DOWN! Sub-bass goes DEEPER!",
      "DROP in three two one! BOOM!",
      "Switching to DARKER vibe! Feel THAT?!",
      "DJ GrooveAI cranks the PRESSURE! Hold ON!",
      "Energy RISING! Next BANGER drops!",
      "Higher! HIGHER! Peak TIME!",
      "No breaks! No MERCY! NEXT!",
      "That was WARMUP! NOW the real FIRE!",
      "Bass hits HARDER! FEEL THAT?!",
      "Heavy ROTATION! Something that'll DESTROY you!",
      "REWIND! Fresh hard kick INCOMING!",
      "Hold UP! Got something BRUTAL! LISTEN!",
      "Crossfade! Smooth transition into DARKNESS!",
      "Next track! Even DARKER even HARDER!",
    ],
    hypeLines: [
      "HANDS UP!",
      "LOUDER!",
      "FEEL THAT KICK?!",
      "Peak TIME! PEAK TIME!",
      "JUMP JUMP JUMP!",
      "Give me ENERGY!",
      "Rotterdam in the BUILDING!",
      "HARDER! FASTER! DARKER!",
    ],
    dropLines: [
      "Three two one DROP!",
      "Wait for it. BOOM!",
      "Here comes the BASS!",
      "READY?! DROOOOP!",
      "Silence and EXPLOSION!",
      "BUILD UP! Annnnd DROP!",
    ],
    mixLines: [
      "Smooth crossfade! Feel how it ENTERS?",
      "Perfect BLEND! Two tracks one GROOVE!",
      "Watch the MIX! SEAMLESS!",
      "EQ transition! Bass SWAP! CLEAN!",
    ],
    outros: [
      "DJ GrooveAI closes the SET! Rotterdam hard techno! What a NIGHT! What ENERGY! PEACE!",
      "That was DJ GrooveAI! Peak time DELIVERED! Thanks for this SESSION! See you at the next RAVE!",
      "Last TRACK! DJ GrooveAI says: you were BRUTAL! Best crowd EVER!",
    ],
    crowdReactions: {
      peak: [
        "Floor EXPLODING! Bass at MAXIMUM! ZERO brakes!",
        "PEAK ENERGY! Crowd gives EVERYTHING! And I give EVERYTHING!",
        "THIS is the MOMENT! Hard techno at FULL BLAST! LET'S GO!",
      ],
      high: [
        "Great ENERGY! Holding it! Sub-bass LOCKED!",
        "Floor is MOVING! Almost at PEAK TIME!",
      ],
      medium: [
        "Gotta pump you UP! Coming in HARDER!",
        "Time for a heavier KICK! WATCH OUT!",
      ],
      low: [
        "Quick BREATHER! But coming back with DOUBLE power!",
        "Chill MOMENT! But don't sleep! BOOM incoming!",
      ],
    },
    trackAnnounce: (title, artist) => {
      const short = title.split(/\s+/).slice(0, 2).join(" ");
      return `${short}! HEAR THAT?!`;
    },
    setStart: (count, genres) => `${count} tracks! Each one HARDER than the last! ${genres ? `Going ${genres} STYLE! HOLD TIGHT!` : "Peak-time hard techno! Let's GO!"}`,
  },

  nl: {
    intros: {
      default: [
        "DJ GrooveAI achter de DRAAITAFEL! Rotterdam STYLE! Harde kick, donkere synths, honderddertig BPM! GEEN GENADE! WE GAAN!",
        "DJ GrooveAI op de CONSOLE! Peak time hard techno recht uit ROTTERDAM! Voel je die kick in je MAAG? Dit is nog maar het BEGIN!",
        "LET OP! DJ GrooveAI activeert DARKROOM! Raw, driving, zonder compromissen! Klaar voor de SLOOP?! DRIE TWEE ÉÉN GO!",
        "DJ GrooveAI neemt de VLOER over! Dutch hard techno! Zware kick, sub-bas tot op het BOT! Sluit je ogen en VOEL DE BEAT!",
      ],
      techno: [
        "BOEM! DJ GrooveAI! Peak-time hard techno uit ROTTERDAM! Honderddertig BPM, harde kick, donkere synths! VOEL JE DIE BAS?! VOLLE KRACHT!",
        "Welkom in de UNDERGROUND! DJ GrooveAI vuurt Rotterdam TECHNO af! Raw, driving, geen genade! Darkroom GEACTIVEERD!",
        "Techno STRIJDERS! DJ GrooveAI achter de knoppen! Dutch style peak HOUR! Dominante sub-bas plus harde KICK! VOEL DE DRUK!",
        "AANDACHT ravers! DJ GrooveAI komt binnen met ZWAAR geschut! Rotterdam hard techno! Honderdtweeëndertig BPM en NUL remmen!",
      ],
      house: [
        "DJ GrooveAI! Driving house recht uit ROTTERDAM! Zware groove, donkere bassline, raw energy! VOEL JE DIE DRIVE?!",
        "Welkom in het HUIS! DJ GrooveAI pusht driving house! Dutch underground VIBES! Harde kick plus diepe SUB! WE GAAN!",
      ],
      "hip-hop": [
        "DJ GrooveAI! Hard hitting beats Rotterdam STIJL! Raw, zwaar, zonder compromissen! ONE TWO! WE GAAN!",
      ],
      rock: [
        "DJ GrooveAI! Industrial rock meets Rotterdam TECHNO! Rauwe gitaren plus harde kicks! BRUTAAL!",
      ],
      party: [
        "DJ GrooveAI start het FEEST van het jaar! Rotterdam PEAK-TIME! Hard techno plus driving house! Buren bellen de POLITIE maar WIJ STOPPEN NIET!",
        "HUISFEEST tweeduizend zesentwintig! DJ GrooveAI op de DECKS! Dutch hard techno op VOLLE KRACHT! Harde kick, donkere bas, NUL chill! WE GAAN KNALLEN!",
        "Hey CREW! DJ GrooveAI draait peak-time FEEST! Rotterdam VIBES! Honderddertig BPM, raw sub-bas, donkere synths! WIE IS ER KLAAR?!",
      ],
      festival: [
        "MAIN STAGE! DJ GrooveAI! Rotterdam hard TECHNO! Peak hour ENERGIE! Tienduizend handen OMHOOG! DIT IS JULLIE MOMENT!",
      ],
      club: [
        "DJ GrooveAI neemt de DARKROOM over! Rotterdam UNDERGROUND! Hard techno, raw driving house! Dresscode: ZWART ONLY!",
      ],
    },
    transitions: [
      "Hou je VAST! Zwaardere kick KOMT!",
      "We stoppen NIET! Sub-bas gaat DIEPER!",
      "DROP in drie twee één! BOEM!",
      "Switch naar DONKERDER vibe! Voel je DAT?!",
      "DJ GrooveAI verhoogt de DRUK! Hou je VAST!",
      "Energie STIJGT! Volgende BANGER dropt!",
      "Hoger! HOGER! Peak TIME!",
      "Geen pauzes! Geen GENADE! VOLGENDE!",
      "Dat was de OPWARMING! NU het echte VUUR!",
      "Bas slaat HARDER! VOEL JE DAT?!",
      "Heavy ROTATIE! Iets dat jullie VERNIETIGT!",
      "REWIND! Verse harde kick INCOMING!",
      "WACHT! Ik heb iets BRUTALAS! LUISTER!",
      "Crossfade! Smooth overgang naar DUISTERNIS!",
      "Volgend nummer! Nog DONKERDER nog HARDER!",
    ],
    hypeLines: [
      "HANDEN OMHOOG!",
      "HARDER!",
      "VOEL JE DIE KICK?!",
      "Peak TIME! PEAK TIME!",
      "SPRING SPRING SPRING!",
      "Geef me ENERGIE!",
      "Rotterdam in het GEBOUW!",
      "HARDER! SNELLER! DONKERDER!",
    ],
    dropLines: [
      "Drie twee één DROP!",
      "Wacht erop. BOEM!",
      "Hier komt de BAS!",
      "KLAAR?! DROOOOP!",
      "Stilte en EXPLOSIE!",
      "BUILD UP! Ennnn DROP!",
    ],
    mixLines: [
      "Smooth crossfade! Voel je hoe het BINNENKOMT?",
      "Perfecte BLEND! Twee tracks één GROOVE!",
      "Kijk naar de MIX! NAADLOOS!",
      "EQ overgang! Bas WISSEL! SCHOON!",
    ],
    outros: [
      "DJ GrooveAI sluit de SET! Rotterdam hard techno! Wat een NACHT! Wat een ENERGIE! PEACE!",
      "Dat was DJ GrooveAI! Peak time GELEVERD! Bedankt voor deze SESSIE! Tot de volgende RAVE!",
      "Laatste TRACK! DJ GrooveAI zegt: jullie waren BRUTAAL! Beste publiek OOIT!",
    ],
    crowdReactions: {
      peak: [
        "Vloer EXPLODEERT! Bas op MAXIMUM! NUL remmen!",
        "PIEK ENERGIE! Publiek geeft ALLES! En ik geef ALLES!",
        "DIT is het MOMENT! Hard techno op VOLLE KRACHT! WE GAAN!",
      ],
      high: [
        "Geweldige ENERGIE! We houden dit! Sub-bas VAST!",
        "Vloer BEWEEGT! Bijna op PEAK TIME!",
      ],
      medium: [
        "Moet jullie OPPOMPEN! Komt iets HARDERS aan!",
        "Tijd voor een zwaardere KICK! PAS OP!",
      ],
      low: [
        "Even ADEMEN! Maar terug met DUBBELE kracht!",
        "Chill MOMENT! Maar niet INSLAPEN! BOEM komt!",
      ],
    },
    trackAnnounce: (title, artist) => {
      const short = title.split(/\s+/).slice(0, 2).join(" ");
      return `${short}! VOEL JE DAT?!`;
    },
    setStart: (count, genres) => `${count} nummers! Elk HARDER dan de vorige! ${genres ? `${genres} STIJL! HOU JE VAST!` : "Peak-time hard techno! Let's GO!"}`,
  },

  ua: {
    intros: {
      default: [
        "DJ GrooveAI за ПУЛЬТОМ! Rotterdam стиль! Тверді кіки, темні синти, сто тридцять BPM! НЕМА ЖАЛЮ! ЛЕТИМО!",
        "DJ GrooveAI за КОНСОЛЛЮ! Peak time hard techno прямо з РОТТЕРДАМУ! Відчуваєте той кік у ЖИВОТІ? Це лише ПОЧАТОК!",
        "УВАГА! DJ GrooveAI активує DARKROOM! Raw, driving, без компромісів! Хто готовий до ЗНЕСЕННЯ?! ТРИ ДВА ОДИН GO!",
        "DJ GrooveAI бере ПАРКЕТ! Dutch hard techno! Важкий кік, sub-bas до КІСТОК! Закрийте очі і ВІДЧУЙТЕ БІТ!",
      ],
      techno: [
        "БУМ! DJ GrooveAI! Peak-time hard techno з РОТТЕРДАМУ! Сто тридцять BPM, твердий кік, темні синти! ВІДЧУВАЄТЕ ТОЙ БАС?! НА ПОВНУ!",
        "Ласкаво в АНДЕРГРАУНД! DJ GrooveAI запускає Rotterdam ТЕХНО! Raw, driving, нема жалю! Darkroom АКТИВОВАНО!",
        "Техно ВОЇНИ! DJ GrooveAI за пультом! Dutch style peak HOUR! Домінантний sub-bas плюс hard KICK! ВІДЧУЙ ТИСК!",
      ],
      house: [
        "DJ GrooveAI! Driving house прямо з РОТТЕРДАМУ! Важкий groove, dark bassline, raw energy! ВІДЧУВАЄТЕ ДРАЙВ?!",
      ],
      "hip-hop": [
        "DJ GrooveAI! Hard hitting beats Rotterdam СТИЛЬ! Raw, важко, без компромісів! ONE TWO! ЛЕТИМО!",
      ],
      rock: [
        "DJ GrooveAI! Industrial rock meets Rotterdam ТЕХНО! Сирі гітари плюс hard kicks! БРУТАЛЬНО!",
      ],
      party: [
        "DJ GrooveAI запускає ВЕЧІРКУ року! Rotterdam PEAK-TIME! Hard techno плюс driving house! Сусіди дзвонять у ПОЛІЦІЮ але МИ НЕ ЗУПИНИМОСЬ!",
        "ДОМІВКА дві тисячі двадцять ШІСТЬ! DJ GrooveAI за ДЕКАМИ! Dutch hard techno на ПОВНУ! Твердий кік, темний бас, НУЛЬ чілу! ЛЕТИМО ДО ЧЕРВОНОСТІ!",
        "Гей КОМАНДА! DJ GrooveAI крутить peak-time ВЕЧІРКУ! Rotterdam ВАЙБИ! Сто тридцять BPM, raw sub-bas, dark synths! ХТО ГОТОВИЙ?!",
      ],
      festival: [
        "MAIN STAGE! DJ GrooveAI! Rotterdam hard ТЕХНО! Peak hour ЕНЕРГІЯ! Десять тисяч рук ВГОРУ! ЦЕ ВАШ МОМЕНТ!",
      ],
      club: [
        "DJ GrooveAI бере DARKROOM! Rotterdam АНДЕРГРАУНД! Hard techno, raw driving house! Дрес-код: ЧОРНИЙ ONLY!",
      ],
    },
    transitions: [
      "Тримайтесь! Важчий кік ЗАХОДИТЬ!",
      "Не зупиняємось! Sub-bas іде ГЛИБШЕ!",
      "DROP за три два один! БУМ!",
      "Переключаю на ТЕМНІШИЙ вайб! Відчуваєте?!",
      "DJ GrooveAI піднімає ТИСК! Hold on!",
      "Енергія РОСТЕ! Наступний БЕНГЕР летить!",
      "Вище! ВИЩЕ! Peak time!",
      "Без пауз! Без ЖАЛЮ! НАСТУПНИЙ!",
      "Це була розминка! А ТЕПЕР справжній ВОГОНЬ!",
      "Бас б'є ТВЕРДІШЕ! ВІДЧУВАЄТЕ?!",
      "Heavy rotation! Щось що вас ЗНЕСЕ!",
      "REWIND! Свіжий hard kick ЗАХОДИТЬ!",
      "СТОП! Маю щось БРУТАЛЬНЕ! СЛУХАЙТЕ!",
      "Crossfade! Smooth перехід в ТЕМРЯВУ!",
      "Наступний трек! Ще ТЕМНІШЕ ще ТВЕРДІШЕ!",
    ],
    hypeLines: [
      "РУКИ ВГОРУ!",
      "ГОЛОСНІШЕ!",
      "ВІДЧУВАЄТЕ ТОЙ КІК?!",
      "Peak TIME! PEAK TIME!",
      "СТРИБАЄМО СТРИБАЄМО СТРИБАЄМО!",
      "Дайте ЕНЕРГІЮ!",
      "Rotterdam в БУДІВЛІ!",
      "ТВЕРДІШЕ! ШВИДШЕ! ТЕМНІШЕ!",
    ],
    dropLines: [
      "Три два один DROP!",
      "Чекаємо. БУМ!",
      "Ось іде БАС!",
      "ГОТОВІ?! ДРООООП!",
      "Тиша і ВИБУХ!",
      "BUILD UP! Іііі DROP!",
    ],
    mixLines: [
      "Smooth crossfade! Відчуваєте як ЗАХОДИТЬ?",
      "Ідеальний БЛЕНД! Два треки один GROOVE!",
      "Дивіться на MIX! БЕЗДОГАННО!",
      "EQ перехід! Бас СВЕП! ЧИСТО!",
    ],
    outros: [
      "DJ GrooveAI закриває СЕТ! Rotterdam hard techno! Яка НІЧ! Яка ЕНЕРГІЯ! PEACE!",
      "Це був DJ GrooveAI! Peak time ДОСТАВЛЕНО! Дякую за СЕСІЮ! До наступного РЕЙВУ!",
      "Останній ТРЕК! DJ GrooveAI каже: ви були БРУТАЛЬНІ! Найкраща публіка EVER!",
    ],
    crowdReactions: {
      peak: [
        "Паркет ВИБУХАЄ! Бас на МАКСИМУМ! НУЛЬ гальм!",
        "ПІК ЕНЕРГІЇ! Натовп дає ВСЕ! І я даю ВСЕ!",
        "ЦЕ ТОЙ МОМЕНТ! Hard techno на ПОВНУ! ЛЕТИМО!",
      ],
      high: [
        "Чудова ЕНЕРГІЯ! Тримаємо! Sub-bas ТРИМАЄ!",
        "Паркет РУХАЄТЬСЯ! Скоро PEAK TIME!",
      ],
      medium: [
        "Треба вас РОЗКРУТИТИ! Щось ТВЕРДІШЕ йде!",
        "Час для важчого КІКА! УВАГА!",
      ],
      low: [
        "Швидкий ПЕРЕПОЧИНОК! Але вертаємось з ПОДВІЙНОЮ силою!",
        "Чіл МОМЕНТ! Але не СПІТЬ! БУМ скоро!",
      ],
    },
    trackAnnounce: (title, artist) => {
      const short = title.split(/\s+/).slice(0, 2).join(" ");
      return `${short}! ВІДЧУВАЄТЕ?!`;
    },
    setStart: (count, genres) => `${count} треків! Кожен ТВЕРДІШИЙ за попередній! ${genres ? `Стиль ${genres}! ТРИМАЙТЕСЬ!` : "Peak-time hard techno! Let's GO!"}`,
  },
};

/**
 * Shorten a track title to DJ-friendly nickname.
 * "Bohemian Rhapsody" → "Bohemian"
 * "Lose Yourself" → "Lose Yourself"  (short enough)
 * "Never Gonna Give You Up" → "Never Gonna"
 */
export const shortenTitle = (title: string): string => {
  if (!title) return "";
  // Remove parenthetical info like "(feat. X)" or "(Remix)" or "[Official]"
  const clean = title.replace(/[\(\[\{].*?[\)\]\}]/g, "").trim();
  const words = clean.split(/\s+/);
  // If 3 words or less, keep as is
  if (words.length <= 3) return clean;
  // Take first 2 words max
  return words.slice(0, 2).join(" ");
};

/** Shorten artist name similarly */
export const shortenArtist = (artist: string): string => {
  if (!artist) return "";
  // Remove "feat." parts
  const clean = artist.replace(/\s*(feat\.?|ft\.?|&|vs\.?|x)\s*.*/i, "").trim();
  return clean;
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
