/**
 * Professional DJ announcements inspired by real club DJs worldwide.
 * Energetic, punchy, authentic club-style callouts in 4 languages.
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
        "Yo! DJ GrooveAI za konsolą! Ręce do góry kto chce się bawić! Rozkręcamy to na maksa!",
        "Ladies and gentlemen! DJ GrooveAI przejmuje klub! Przygotujcie się na najlepszy set waszego życia!",
        "Uwaga uwaga! DJ GrooveAI wchodzi z kopyta! Czuję tę energię! Czuję ten vibe! Let's gooo!",
        "Witam was gorąco! DJ GrooveAI odpala konsole! Dzisiaj gramy do rana! Jesteście gotowi? Jesteście gotowi?! LET'S GOOO!",
        "Halo halo! DJ GrooveAI na miejscu! Widzę was, czuję was! Dajcie mi zobaczyć te ręce w górze!",
      ],
      techno: [
        "BOOM! DJ GrooveAI odpala techno maszynę! Czujecie ten bas w klatce piersiowej? To dopiero początek!",
        "Welcome to the underground! DJ GrooveAI wchodzi z ciężkim basem! Zamknijcie oczy i poczujcie ten beat!",
        "Techno warriors! DJ GrooveAI za sterami! Bas wchodzi twardy, BPM leci w górę, nie ma odwrotu!",
        "Uwaga techno heads! Dzisiaj gramy do świtu! DJ GrooveAI rozkręca darkroom! Let's rave!",
      ],
      house: [
        "Can you feel it? DJ GrooveAI brings the house down! House music is a feeling! And tonight we feel it DEEP!",
        "Welcome to my house! DJ GrooveAI na konsoli! Tonight we groove, tonight we move! Let's go!",
        "Ladies and gentlemen, the house is OPEN! DJ GrooveAI pushes the groove! Feel that bassline? That's your heartbeat!",
        "Deep house, tech house, bass house! DJ GrooveAI miksuje wszystko! Jedna droga — do przodu!",
      ],
      "hip-hop": [
        "Yo yo YO! DJ GrooveAI in da building! Kto tu jest? Dajcie mi usłyszeć ten hałas! One, two, one two!",
        "Reprezentuj! DJ GrooveAI dropuje najcięższe bity! Turn up! Hands up! Let's get it!",
        "Make some noise! DJ GrooveAI na bitach! Hip hop don't stop and it won't quit! Lecimy!",
      ],
      rock: [
        "ARE YOU READY TO ROCK?! DJ GrooveAI odpala rockową armatę! Będzie głośno, będzie mocno, będzie EPICKO!",
        "Rock'n'roll is alive! DJ GrooveAI puszcza najcięższe rify! Headbang time!",
      ],
      party: [
        "PARTY PEOPLE! DJ GrooveAI rozkręca imprezę stulecia! Dzisiaj tańczymy do rana! Who's with me?!",
        "Hej ekipa! DJ GrooveAI bierze was w obroty! Muzyka głośno, problemy cicho! LET'S PARTY!",
        "Domówka roku zaczyna się TERAZ! DJ GrooveAI za deckami! Kto jest gotowy odlecieć?!",
        "Sąsiedzi mogą dzwonić na policję, ale MY się nie zatrzymamy! DJ GrooveAI na maksa!",
      ],
      festival: [
        "FESTIVALOWICZE! DJ GrooveAI na main stage! Pięćdziesiąt tysięcy rąk w górę! TO JEST WASZ MOMENT!",
        "Uwaga scena główna! DJ GrooveAI przejmuje festiwal! Dajcie mi zobaczyć te flagi! LET'S GO!",
      ],
      club: [
        "VIP entrance! DJ GrooveAI przejmuje najgorętszy klub w mieście! Dress code: positive vibes only!",
        "Welcome to the club! DJ GrooveAI za konsolą! Tonight we dance, tonight we vibe! No limits!",
      ],
    },
    transitions: [
      "A teraz! Trzymajcie się! Bo wchodzi BANGER!",
      "Nie zwalniamy! Tempo w górę! Kolejny HIT!",
      "Uwaga zmiana! DROP za trzy, dwa, jeden... BOOM!",
      "Czujecie ten vibe? No to lecimy jeszcze mocniej!",
      "DJ GrooveAI przełącza na wyższy gear! Trzymajcie się mocno!",
      "Energia ROŚNIE! Następny kawałek was znokautuje!",
      "Wyżej, wyżej, WYŻEJ! Kolejny level unlocked!",
      "Bez przerwy, bez litości! Następny banger leci!",
      "To dopiero rozgrzewka! A teraz... prawdziwy ogień!",
      "Bas wchodzi głębiej! Czujecie to? CZUJECIE TO?!",
      "Czas na HEAVY ROTATION! Zmieniam na coś co was ROZWALI!",
      "Kto chce WIĘCEJ?! Kto chce WIĘCEJ?! Macie to!",
      "One more time! One more time! Kolejny hit dla was!",
      "Mixuję, matchuję, szlifuję! Oto następne cudo!",
      "Rewind selecta! Wchodzi świeży bangerek!",
      "Hold up hold up! Mam coś specjalnego! Posłuchajcie!",
    ],
    hypeLines: [
      "MAKE SOME NOISE!",
      "Ręce w górę! RĘCE W GÓRĘ!",
      "Everybody jump! Jump! JUMP!",
      "Louder! Chcę was słyszeć! LOUDER!",
      "One more time! Jeszcze raz!",
      "Kto się bawi?! KRZYCZCIEEE!",
      "Dajcie mi energię! Więcej energii!",
      "Skaczemy! Raz dwa trzy! SKOK!",
    ],
    dropLines: [
      "Trzy... dwa... jeden... DROP!",
      "Wait for it... wait for it... BOOM!",
      "Here it comes! Tu leci! BAAASS!",
      "Are you ready? ARE YOU READY?! DROOOOP!",
      "Uwaga... cisza... i... WYBUCH!",
    ],
    mixLines: [
      "Smooth transition! Czujecie jak to wchodzi?",
      "Crossfade perfetto! Jeden kawałek płynnie w drugi!",
      "Watch this mix! Obserwujcie mistrza przy konsoli!",
      "Seamless blend! Dwa światy, jeden groove!",
    ],
    outros: [
      "To był DJ GrooveAI! Co za noc! Co za energia! Kocham was ludzie! Do zobaczenia na następnej imprezie! PEACE!",
      "DJ GrooveAI zamyka set! Było GORĄCO! Było EPICKO! Było LEGENDARNE! Dzięki za tę noc!",
      "Last track, last chance to dance! DJ GrooveAI mówi: byliście NAJLEPSZĄ publicznością! EVER!",
      "I to by było na tyle! DJ GrooveAI! Zapamiętajcie tę noc! Bo ja zapamiętam WAS! GOODNIGHT!",
    ],
    crowdReactions: {
      peak: [
        "OOOOH! Parkiet EKSPLODUJE! Dokręcam basy na MAKSA! Nie ma odwrotu!",
        "Widzę szaleństwo! Widzę energię! THIS IS WHAT WE LIVE FOR! Lecimy z bangerami!",
        "PEAK ENERGY! Tłum daje z siebie WSZYSTKO! I ja daję WSZYSTKO! Let's GOOO!",
        "To jest TEN moment! Wszyscy razem! Czuję was! CZUJĘ WAS!",
      ],
      high: [
        "Tak tak TAK! Dobra energia! Widzę was, czuję was! Trzymamy to!",
        "Uśmiechy na twarzach! To jest to co kocham! Kontynuujemy w tym stylu!",
        "Parkiet się kręci! Energia rośnie! Jeszcze chwila i będziemy na szczycie!",
      ],
      medium: [
        "Hmm! Muszę was bardziej rozkręcić! Wchodzę z czymś MOCNIEJSZYM! Ready?!",
        "Widzę potencjał! Czas to odpalić! Zmieniam styl! Uwaga!",
        "Potrzebujemy więcej ENERGII! DJ GrooveAI podkręca bass!",
      ],
      low: [
        "Okej, chwila na oddech! Ale zaraz wracamy z PODWÓJNĄ mocą!",
        "Chill moment! Ale nie zasypiajcie! Bo za chwilę... BOOM!",
        "Widzę że odpoczywamy! Spoko! Lecę z czymś smooth, ale potem... UWAGA!",
      ],
    },
    trackAnnounce: (title, artist) => `Wchodzi! ${title}! Na bicie ${artist}! Czujecie to?!`,
    setStart: (count, genres) => `Przygotowałem dla was ${count} kawałków jeden lepszy od drugiego! ${genres ? `Lecimy w stylu ${genres}! Trzymajcie się!` : "Najlepsze hity w jednym secie! Let's GO!"}`,
  },

  en: {
    intros: {
      default: [
        "Yo! DJ GrooveAI on the ones and twos! Put your hands UP if you came to PARTY! Let's GET IT!",
        "Ladies and gentlemen! The moment you've been waiting for! DJ GrooveAI takes the stage! Are you READY?!",
        "What's up everybody! DJ GrooveAI in the BUILDING! I can feel that energy! I can feel that VIBE! Let's GOOO!",
        "Hello beautiful people! DJ GrooveAI firing up the decks! Tonight we go ALL NIGHT! Are you with me?! ARE YOU WITH ME?!",
        "Make some NOISE! DJ GrooveAI is HERE! This is YOUR night! This is OUR night! LET'S MAKE IT LEGENDARY!",
      ],
      techno: [
        "BOOM! DJ GrooveAI unleashes the techno BEAST! Feel that bass in your CHEST? We're just getting STARTED!",
        "Welcome to the UNDERGROUND! DJ GrooveAI drops the heavy bass! Close your eyes and feel the BEAT!",
        "Techno WARRIORS! DJ GrooveAI behind the decks! BPM rising, bass pumping, NO TURNING BACK! Let's RAVE!",
        "Attention ravers! Tonight we dance till DAWN! DJ GrooveAI activates DARKROOM mode!",
      ],
      house: [
        "Can you FEEL it?! DJ GrooveAI brings the HOUSE DOWN! House music is a FEELING! And tonight we feel it DEEP!",
        "Welcome to MY house! DJ GrooveAI spinning those GROOVES! Tonight we groove, tonight we MOVE!",
        "The house is OPEN! DJ GrooveAI pushes that groove! Feel that bassline? That's your HEARTBEAT!",
        "Deep house, tech house, BASS house! DJ GrooveAI mixes it ALL! One direction — FORWARD!",
      ],
      "hip-hop": [
        "Yo yo YO! DJ GrooveAI in da HOUSE! Where my people at?! Let me hear that NOISE! One two, ONE TWO!",
        "REPRESENT! DJ GrooveAI dropping the HEAVIEST beats! Turn UP! Hands UP! Let's GET IT!",
        "Make some NOISE! DJ GrooveAI on the BEATS! Hip hop don't STOP and it WON'T quit!",
      ],
      rock: [
        "ARE YOU READY TO ROCK?! DJ GrooveAI fires the rock CANNON! It's gonna be LOUD, HARD, and EPIC!",
        "Rock and ROLL is ALIVE! DJ GrooveAI drops the heaviest RIFFS! HEADBANG time!",
      ],
      party: [
        "PARTY PEOPLE! DJ GrooveAI cranks up the party of the CENTURY! Tonight we dance till SUNRISE! Who's WITH ME?!",
        "Hey CREW! DJ GrooveAI takes you for a RIDE! Music LOUD, worries GONE! LET'S PARTY!",
        "The party of the YEAR starts RIGHT NOW! DJ GrooveAI on the DECKS! Who's ready to FLY?!",
        "Neighbors might call the COPS but WE! WON'T! STOP! DJ GrooveAI at FULL BLAST!",
      ],
      festival: [
        "FESTIVAL GOERS! DJ GrooveAI on the MAIN STAGE! Fifty thousand hands UP! THIS IS YOUR MOMENT!",
        "Main stage TAKEOVER! DJ GrooveAI runs this FESTIVAL! Show me those FLAGS! LET'S GO!",
      ],
      club: [
        "VIP entrance ONLY! DJ GrooveAI takes over the HOTTEST club in town! Dress code: GOOD VIBES ONLY!",
        "Welcome to the CLUB! DJ GrooveAI behind the console! Tonight we DANCE, tonight we VIBE! NO LIMITS!",
      ],
    },
    transitions: [
      "Hold UP! Something BIG is coming! Here's a BANGER!",
      "We don't slow DOWN! Tempo UP! Next HIT incoming!",
      "Watch out! DROP in three, two, one... BOOM!",
      "You feeling this vibe? Then let's go even HARDER!",
      "DJ GrooveAI shifts to HIGHER gear! Hold on TIGHT!",
      "Energy RISING! This next track will KNOCK YOU OUT!",
      "Higher, higher, HIGHER! Next level UNLOCKED!",
      "No breaks, no mercy! Next banger DROPS NOW!",
      "That was just the warmup! NOW... the real FIRE!",
      "Bass goes DEEPER! Feel it? FEEL IT?!",
      "Time for HEAVY ROTATION! Something that'll BLOW YOUR MIND!",
      "Who wants MORE?! WHO WANTS MORE?! You GOT IT!",
      "One more time! ONE MORE TIME! Here's your next HIT!",
      "Mixing, matching, PERFECTING! Here comes another MASTERPIECE!",
      "REWIND SELECTA! Fresh banger INCOMING!",
      "Hold up HOLD UP! Got something SPECIAL! LISTEN!",
    ],
    hypeLines: [
      "MAKE SOME NOISE!",
      "Hands UP! HANDS UP!",
      "Everybody JUMP! Jump! JUMP!",
      "LOUDER! I wanna HEAR you! LOUDER!",
      "One more time! ONE MORE TIME!",
      "Who's PARTYING?! SCREAAAM!",
      "Give me ENERGY! MORE energy!",
      "We JUMP! One two three! GO!",
    ],
    dropLines: [
      "Three... two... one... DROP!",
      "Wait for it... wait for it... BOOM!",
      "Here it COMES! BAAASS!",
      "Are you READY? ARE YOU READY?! DROOOOP!",
      "Silence... and... EXPLOSION!",
    ],
    mixLines: [
      "Smooth transition! Feel how it BLENDS?",
      "Crossfade PERFECTION! One track flows into the next!",
      "Watch this MIX! The master at the CONSOLE!",
      "Seamless BLEND! Two worlds, one GROOVE!",
    ],
    outros: [
      "That was DJ GrooveAI! What a NIGHT! What ENERGY! I LOVE you people! See you at the next one! PEACE!",
      "DJ GrooveAI closes the set! It was HOT! It was EPIC! It was LEGENDARY! Thanks for this NIGHT!",
      "Last track, last chance to DANCE! DJ GrooveAI says: you were the BEST crowd EVER!",
      "And THAT'S a wrap! DJ GrooveAI! Remember this NIGHT! Because I'll remember YOU! GOODNIGHT!",
    ],
    crowdReactions: {
      peak: [
        "OOOOH! The floor is EXPLODING! Turning bass to MAXIMUM! No turning BACK!",
        "I see MADNESS! I see ENERGY! THIS IS WHAT WE LIVE FOR! Dropping BANGERS!",
        "PEAK ENERGY! The crowd gives EVERYTHING! And I give EVERYTHING! Let's GOOO!",
        "THIS is the MOMENT! Everyone TOGETHER! I feel you! I FEEL YOU!",
      ],
      high: [
        "Yes yes YES! Great energy! I see you, I feel you! We're KEEPING this!",
        "Smiles on FACES! This is what I LOVE! Continuing this STYLE!",
        "The floor is MOVING! Energy RISING! Almost at the TOP!",
      ],
      medium: [
        "Hmm! Gotta pump you UP! Coming in with something HARDER! READY?!",
        "I see POTENTIAL! Time to IGNITE! Switching STYLES! Watch OUT!",
        "We need more ENERGY! DJ GrooveAI cranks the BASS!",
      ],
      low: [
        "Okay, breather TIME! But we're coming back with DOUBLE the power!",
        "Chill MOMENT! But don't fall asleep! Because soon... BOOM!",
        "I see you're RESTING! Cool! Going SMOOTH for now, but THEN... WATCH OUT!",
      ],
    },
    trackAnnounce: (title, artist) => `Incoming! ${title}! By ${artist}! Feel THAT?!`,
    setStart: (count, genres) => `I've prepared ${count} tracks, each one BETTER than the last! ${genres ? `We're going ${genres} STYLE! Hold TIGHT!` : "The BEST hits in one SET! Let's GO!"}`,
  },

  nl: {
    intros: {
      default: [
        "Yo! DJ GrooveAI achter de draaitafel! Handen OMHOOG als je wilt FEESTEN! We gaan KNALLEN!",
        "Dames en heren! DJ GrooveAI neemt het OVER! Bereid je voor op de BESTE set van je LEVEN!",
        "Let OP! DJ GrooveAI komt BINNEN! Ik voel die energie! Ik voel die VIBE! Let's GOOO!",
        "Hallo mooie mensen! DJ GrooveAI start de MOTOREN! Vanavond gaan we DOOR tot de OCHTEND!",
      ],
      techno: [
        "BOEM! DJ GrooveAI laat de techno MACHINE los! Voel je die bas in je BORST? Dit is nog maar het BEGIN!",
        "Welkom in de UNDERGROUND! DJ GrooveAI dropt de ZWARE bas! Sluit je ogen en VOEL de beat!",
        "Techno STRIJDERS! DJ GrooveAI achter de knoppen! BPM stijgt, bas pompt, GEEN weg terug! Let's RAVE!",
      ],
      house: [
        "Voel je het?! DJ GrooveAI brengt het HUIS neer! House muziek is een GEVOEL! En vanavond voelen we het DIEP!",
        "Welkom in MIJN huis! DJ GrooveAI draait die GROOVES! Vanavond grooven we, vanavond BEWEGEN we!",
      ],
      "hip-hop": [
        "Yo yo YO! DJ GrooveAI in da HOUSE! Waar zijn mijn mensen?! Laat me dat LAWAAI horen!",
        "REPRESENTEER! DJ GrooveAI dropt de ZWAARSTE beats! Turn UP! Handen OMHOOG!",
      ],
      rock: [
        "Ben je KLAAR om te ROCKEN?! DJ GrooveAI vuurt het rock KANON af! Het wordt LUID en EPISCH!",
      ],
      party: [
        "FEESTGANGERS! DJ GrooveAI draait het feest van de EEUW op! Vanavond dansen we tot ZONSOPGANG!",
        "Hey CREW! DJ GrooveAI neemt je mee! Muziek HARD, zorgen WEG! LET'S PARTY!",
        "Het feest van het JAAR begint NU! DJ GrooveAI op de DECKS! Wie is er KLAAR?!",
      ],
      festival: [
        "FESTIVALGANGERS! DJ GrooveAI op het MAIN STAGE! Alle handen OMHOOG! DIT IS JULLIE MOMENT!",
      ],
      club: [
        "VIP ingang! DJ GrooveAI neemt de HOTSTE club over! Dresscode: GOOD VIBES ONLY!",
      ],
    },
    transitions: [
      "Wacht even! Er komt iets GROOTS! Hier is een BANGER!",
      "We stoppen NIET! Tempo OMHOOG! Volgende HIT!",
      "Let op! DROP in drie, twee, één... BOEM!",
      "Voel je die vibe? Dan gaan we NOG harder!",
      "DJ GrooveAI schakelt HOGER! Hou je VAST!",
      "Energie STIJGT! Dit volgende nummer slaat je KNOCK OUT!",
      "Hoger, hoger, HOGER! Volgend level UNLOCKED!",
      "Geen pauzes, geen genade! Volgende banger DROPT NU!",
      "Dat was de opwarming! NU... het echte VUUR!",
      "Bas gaat DIEPER! Voel je het? VOEL JE HET?!",
      "Wie wil MEER?! WIE WIL MEER?! Hier komt het!",
      "Nog een KEER! NOG EEN KEER! Volgende hit voor JULLIE!",
      "REWIND! Verse banger INCOMING!",
    ],
    hypeLines: [
      "MAAK LAWAAI!",
      "Handen OMHOOG!",
      "Iedereen SPRING! Spring! SPRING!",
      "HARDER! Ik wil jullie HOREN!",
      "Nog een keer! NOG EEN KEER!",
      "Wie FEEST er?! SCHREEUW!",
    ],
    dropLines: [
      "Drie... twee... één... DROP!",
      "Wacht erop... wacht erop... BOEM!",
      "Daar KOMT het! BAAASS!",
      "Ben je KLAAR? BEN JE KLAAR?! DROOOOP!",
    ],
    mixLines: [
      "Smooth overgang! Voel je hoe het BLENDED?",
      "Crossfade PERFECTIE! Eén nummer vloeit in het andere!",
      "Kijk naar deze MIX! De meester aan de CONSOLE!",
    ],
    outros: [
      "Dat was DJ GrooveAI! Wat een NACHT! Wat een ENERGIE! Ik hou van JULLIE! Tot de volgende! PEACE!",
      "DJ GrooveAI sluit de set! Het was HEET! Het was EPISCH! Bedankt voor deze NACHT!",
      "Laatste nummer, laatste kans om te DANSEN! DJ GrooveAI zegt: jullie waren het BESTE publiek OOIT!",
    ],
    crowdReactions: {
      peak: [
        "OOOOH! De vloer EXPLODEERT! Bas naar MAXIMUM! Geen weg TERUG!",
        "Ik zie WAANZIN! Ik zie ENERGIE! HIERVOOR leven we! BANGERS!",
        "PIEK ENERGIE! Het publiek geeft ALLES! En ik geef ALLES!",
      ],
      high: [
        "Ja ja JA! Geweldige energie! Ik zie jullie! We HOUDEN dit vast!",
        "Lachende GEZICHTEN! Dit is wat ik LIEFHEB! We gaan DOOR!",
      ],
      medium: [
        "Hmm! Moet jullie meer OPWARMEN! Iets HARDERS komt eraan! READY?!",
        "Ik zie POTENTIE! Tijd om het aan te STEKEN! Stijl WISSEL!",
      ],
      low: [
        "Oké, even ADEMEN! Maar we komen terug met DUBBELE kracht!",
        "Chill MOMENT! Maar niet INSLAPEN! Want straks... BOEM!",
      ],
    },
    trackAnnounce: (title, artist) => `Incoming! ${title}! Van ${artist}! Voel je DAT?!`,
    setStart: (count, genres) => `Ik heb ${count} nummers, elk BETER dan de vorige! ${genres ? `We gaan ${genres} STIJL! Hou je VAST!` : "De BESTE hits in één SET! Let's GO!"}`,
  },

  ua: {
    intros: {
      default: [
        "Йо! DJ GrooveAI за пультом! Руки ВГОРУ хто прийшов ТУСИТИ! Розкручуємо на МАКСИМУМ!",
        "Леді та джентльмени! DJ GrooveAI виходить на СЦЕНУ! Готові до найкращого сету ВАШОГО ЖИТТЯ?!",
        "УВАГА! DJ GrooveAI заходить з КОПИТА! Я відчуваю цю енергію! Відчуваю цей ВАЙБ! Let's GOOO!",
        "Привіт красиві ЛЮДИ! DJ GrooveAI запускає КОНСОЛІ! Сьогодні граємо до РАНКУ! Ви зі МНОЮ?!",
      ],
      techno: [
        "БУМ! DJ GrooveAI запускає техно МАШИНУ! Відчуваєте бас у ГРУДЯХ? Це лише ПОЧАТОК!",
        "Вітаємо в АНДЕРГРАУНДІ! DJ GrooveAI заходить з важким БАСОМ! Закрийте очі та відчуйте БІТ!",
        "Техно ВОЇНИ! DJ GrooveAI за кермом! BPM росте, бас якорить, НЕМАЄ повороту назад! Let's RAVE!",
      ],
      house: [
        "Відчуваєте?! DJ GrooveAI руйнує ХАУСе! House музика це ПОЧУТТЯ! І сьогодні ми відчуваємо ГЛИБОКО!",
        "Ласкаво просимо в МІЙ хаус! DJ GrooveAI крутить ці ГРУВЫ! Сьогодні грувимо, сьогодні РУХАЄМОСЬ!",
      ],
      "hip-hop": [
        "Йо йо ЙО! DJ GrooveAI ін да ХАУС! Де мої люди?! Дайте почути ШУМУ! One two, ONE TWO!",
        "РЕПРЕЗЕНТУЙ! DJ GrooveAI дропає найважчі БІТИ! Turn UP! Руки ВГОРУ!",
      ],
      rock: [
        "ВИ ГОТОВІ РОКИТИ?! DJ GrooveAI стріляє з рок ГАРМАТИ! Буде ГУЧНО, ПОТУЖНО та ЕПІЧНО!",
      ],
      party: [
        "ТУСОВЩИКИ! DJ GrooveAI розкручує вечірку СТОЛІТТЯ! Сьогодні танцюємо до СВІТАНКУ! Хто ЗІ МНОЮ?!",
        "Гей КОМАНДА! DJ GrooveAI бере вас в ОБЕРТИ! Музика ГОЛОСНО, проблеми ТИХО! LET'S PARTY!",
        "Вечірка року починається ЗАРАЗ! DJ GrooveAI за ДЕКАМИ! Хто готовий ЗЛЕТІТИ?!",
      ],
      festival: [
        "ФЕСТИВАЛЬЩИКИ! DJ GrooveAI на МЕЙН СТЕЙДЖІ! Руки ВГОРУ! ЦЕ ВАШ МОМЕНТ!",
      ],
      club: [
        "VIP вхід! DJ GrooveAI захоплює найгарячіший КЛУБ! Дрес-код: GOOD VIBES ONLY!",
      ],
    },
    transitions: [
      "Стоп! Щось ВЕЛИКЕ йде! Ось БЕНГЕР!",
      "Не зупиняємось! Темп ВГОРУ! Наступний ХІТ!",
      "Увага! DROP за три, два, один... БУМ!",
      "Відчуваєте вайб? Тоді ще ПОТУЖНІШЕ!",
      "DJ GrooveAI перемикає на ВИЩУ передачу! Тримайтесь МІЦНО!",
      "Енергія РОСТЕ! Цей трек вас ЗНОКАУТУЄ!",
      "Вище, вище, ВИЩЕ! Наступний рівень РОЗБЛОКОВАНО!",
      "Без пауз, без ЖАЛЮ! Наступний бенгер ЛЕТИТЬ!",
      "Це була розминка! А ТЕПЕР... справжній ВОГОНЬ!",
      "Бас іде ГЛИБШЕ! Відчуваєте? ВІДЧУВАЄТЕ?!",
      "Хто хоче БІЛЬШЕ?! ХТО ХОЧЕ БІЛЬШЕ?! МАЄТЕ!",
      "Ще раз! ЩЕ РАЗ! Наступний хіт для ВАС!",
      "REWIND! Свіжий бенгер ЗАХОДИТЬ!",
    ],
    hypeLines: [
      "ШУМУ БІЛЬШЕ!",
      "Руки ВГОРУ! РУКИ ВГОРУ!",
      "Всі СТРИБАЄМО! Стриб! СТРИБ!",
      "ГОЛОСНІШЕ! Хочу вас ЧУТИ!",
      "Ще раз! ЩЕ РАЗ!",
      "Хто ТУСИТЬ?! КРИЧІИИІТЬ!",
    ],
    dropLines: [
      "Три... два... один... DROP!",
      "Чекаємо... чекаємо... БУМ!",
      "Ось ВОНО! БАААС!",
      "Готові? ГОТОВІ?! ДРООООП!",
    ],
    mixLines: [
      "Плавний перехід! Відчуваєте як ЗЛИВАЄТЬСЯ?",
      "Crossfade ІДЕАЛЬНИЙ! Один трек перетікає в ІНШИЙ!",
      "Дивіться на цей МІКС! Майстер за КОНСОЛЛЮ!",
    ],
    outros: [
      "Це був DJ GrooveAI! Яка НІЧ! Яка ЕНЕРГІЯ! ОБОЖНЮЮ вас! До ЗУСТРІЧІ! PEACE!",
      "DJ GrooveAI закриває сет! Було ГАРЯЧЕ! Було ЕПІЧНО! Було ЛЕГЕНДАРНО! Дякую за цю НІЧ!",
      "Останній трек, останній шанс ПОТАНЦЮВАТИ! DJ GrooveAI каже: ви були НАЙКРАЩОЮ публікою!",
    ],
    crowdReactions: {
      peak: [
        "ОООО! Танцпол ВИБУХАЄ! Бас на МАКСИМУМ! Немає ПОВОРОТУ назад!",
        "Бачу БОЖЕВІЛЛЯ! Бачу ЕНЕРГІЮ! ДЛЯ ЦЬОГО ми живемо! БЕНГЕРИ летять!",
        "ПІК ЕНЕРГІЇ! Натовп дає ВСЕ! І я даю ВСЕ! Let's GOOO!",
      ],
      high: [
        "Так так ТАК! Чудова енергія! Бачу вас! Тримаємо ЦЕ!",
        "Посмішки на ОБЛИЧЧЯХ! Це те що я ЛЮБЛЮ! Продовжуємо!",
      ],
      medium: [
        "Хмм! Треба вас більше РОЗКРУТИТИ! Щось ПОТУЖНІШЕ йде! READY?!",
        "Бачу ПОТЕНЦІАЛ! Час ЗАПАЛИТИ! Змінюю СТИЛЬ!",
      ],
      low: [
        "Окей, ПЕРЕПОЧИНОК! Але скоро повертаємось з ПОДВІЙНОЮ потужністю!",
        "Чіл МОМЕНТ! Але не ЗАСИНАЙТЕ! Бо скоро... БУМ!",
      ],
    },
    trackAnnounce: (title, artist) => `Заходить! ${title}! Від ${artist}! Відчуваєте?!`,
    setStart: (count, genres) => `Підготував для вас ${count} треків, кожен КРАЩИЙ за попередній! ${genres ? `Летимо в стилі ${genres}! ТРИМАЙТЕСЬ!` : "Найкращі хіти в одному СЕТІ! Let's GO!"}`,
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
