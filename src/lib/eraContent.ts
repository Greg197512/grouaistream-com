// Lokalizacja GROUA ERA (PL/EN/NL/UA). Polski pochodzi z pól w eraEngine (fallback),
// tutaj trzymamy tłumaczenia EN/NL/UA oraz teksty UI całej sekcji ERA.
import type { Language } from "@/i18n/translations";
import type { Era } from "@/lib/eraEngine";

export interface EraText {
  label: string;
  tagline: string;
  vibe: string;
  description: string;
  soundmarks: string[];
  culture: { label: string; value: string }[];
  didYouKnow: string;
}

// Teksty UI sekcji ERA — wszystkie 4 języki.
export const ERA_UI: Record<Language, Record<string, string>> = {
  pl: {
    brand: "Groua Era · Nostalgia Engine",
    enterTitle: "Wejdź w epokę",
    entrySubtitle: "Wybierz czas, do którego chcesz wejść — muzyka zabierze Cię w podróż.",
    allEras: "Wszystkie epoki →",
    hubSubtitle: "To nie tylko kolejny utwór — wybierz czas, do którego chcesz wejść, a muzyka zabierze Cię w podróż.",
    journey: "Podróż przez czas — od 70s do dziś",
    dnaTitle: "Twoje Nostalgia DNA",
    dnaSub: "Z czego naprawdę składa się Twój gust — policzone z historii odsłuchów.",
    hubFooter: "Nie żyłeś w 1987? Nie szkodzi — możesz go odkryć. Każda epoka to Współcześni twórcy + AI ERA.",
    back: "Wszystkie epoki",
    aboutTitle: "O epoce",
    soundmarksLabel: "Charakterystyczne brzmienie",
    contextLabel: "Kontekst",
    artistsLabel: "Znani twórcy epoki",
    artistsNote: "Dla kontekstu historycznego. GrouAI gra własny katalog i muzykę AI w klimacie epoki — nie odtwarza ani nie naśladuje tych artystów.",
    didYouKnowLabel: "Czy wiesz, że…",
    factLoading: "świeża ciekawostka od AI…",
    factTagAI: "ciekawostka AI",
    factTagStatic: "GrouAI",
    refresh: "Nowa",
    nowTitle: "Brzmi jak ta epoka",
    nowSub: "Współcześni twórcy trzymający ten sound — z żywego katalogu GrouAI",
    aiTitle: "AI ERA",
    aiSub: "Nowa muzyka AI w charakterze epoki — styl epoki, nie osoby",
    play: "Odtwórz",
    shuffle: "Losowo",
    nowEmpty: "Brak dopasowań w katalogu — spróbuj sąsiedniej epoki lub stwórz to brzmienie w AI poniżej.",
    aiEmpty: "Jeszcze nikt nie stworzył tej epoki w AI. Bądź pierwszy 👇",
    createInAI: "Stwórz ten rok w AI — tak brzmiałby, gdyby istniało AI",
    loading: "Wczytuję…",
    studioBannerTitle: "Tworzysz epokę: GROUA ERA",
    studioBannerSub: "Ustawienia dobrane pod charakter epoki — możesz je dowolnie zmienić.",
  },
  en: {
    brand: "Groua Era · Nostalgia Engine",
    enterTitle: "Enter the era",
    entrySubtitle: "Pick the time you want to step into — the music takes you on a journey.",
    allEras: "All eras →",
    hubSubtitle: "Not just the next track — choose the time you want to step into, and the music takes you on a journey.",
    journey: "Journey through time — from the 70s to today",
    dnaTitle: "Your Nostalgia DNA",
    dnaSub: "What your taste is really made of — measured from your listening history.",
    hubFooter: "You weren't alive in 1987? No problem — you can still discover it. Every era is Contemporary artists + AI ERA.",
    back: "All eras",
    aboutTitle: "About the era",
    soundmarksLabel: "Signature sound",
    contextLabel: "Context",
    artistsLabel: "Iconic artists of the era",
    artistsNote: "For historical context. GrouAI plays its own catalog and AI music in the era's spirit — it does not play or imitate these artists.",
    didYouKnowLabel: "Did you know…",
    factLoading: "fresh fact from AI…",
    factTagAI: "AI fact",
    factTagStatic: "GrouAI",
    refresh: "New",
    nowTitle: "Sounds like this era",
    nowSub: "Contemporary artists keeping the sound alive — from the live GrouAI catalog",
    aiTitle: "AI ERA",
    aiSub: "New AI music in the era's character — the style of the era, not the person",
    play: "Play",
    shuffle: "Shuffle",
    nowEmpty: "No matches in the catalog — try a neighboring era or create this sound with AI below.",
    aiEmpty: "No one has created this era with AI yet. Be the first 👇",
    createInAI: "Create this year with AI — how it would sound if AI existed",
    loading: "Loading…",
    studioBannerTitle: "You're creating an era: GROUA ERA",
    studioBannerSub: "Settings tuned to the era's character — feel free to change anything.",
  },
  nl: {
    brand: "Groua Era · Nostalgia Engine",
    enterTitle: "Betreed het tijdperk",
    entrySubtitle: "Kies de tijd die je wilt binnenstappen — de muziek neemt je mee op reis.",
    allEras: "Alle tijdperken →",
    hubSubtitle: "Niet zomaar het volgende nummer — kies de tijd die je wilt binnenstappen, en de muziek neemt je mee op reis.",
    journey: "Reis door de tijd — van de jaren 70 tot nu",
    dnaTitle: "Jouw Nostalgia DNA",
    dnaSub: "Waar je smaak echt uit bestaat — berekend uit je luistergeschiedenis.",
    hubFooter: "Je leefde niet in 1987? Geen probleem — je kunt het toch ontdekken. Elk tijdperk is Hedendaagse artiesten + AI ERA.",
    back: "Alle tijdperken",
    aboutTitle: "Over het tijdperk",
    soundmarksLabel: "Kenmerkende sound",
    contextLabel: "Context",
    artistsLabel: "Iconische artiesten van het tijdperk",
    artistsNote: "Voor historische context. GrouAI speelt zijn eigen catalogus en AI-muziek in de geest van het tijdperk — het speelt of imiteert deze artiesten niet.",
    didYouKnowLabel: "Wist je dat…",
    factLoading: "vers weetje van AI…",
    factTagAI: "AI-weetje",
    factTagStatic: "GrouAI",
    refresh: "Nieuw",
    nowTitle: "Klinkt als dit tijdperk",
    nowSub: "Hedendaagse artiesten die de sound levend houden — uit de live GrouAI-catalogus",
    aiTitle: "AI ERA",
    aiSub: "Nieuwe AI-muziek in het karakter van het tijdperk — de stijl van het tijdperk, niet de persoon",
    play: "Afspelen",
    shuffle: "Willekeurig",
    nowEmpty: "Geen matches in de catalogus — probeer een naburig tijdperk of maak deze sound hieronder met AI.",
    aiEmpty: "Niemand heeft dit tijdperk nog met AI gemaakt. Wees de eerste 👇",
    createInAI: "Maak dit jaar met AI — hoe het zou klinken als AI bestond",
    loading: "Laden…",
    studioBannerTitle: "Je maakt een tijdperk: GROUA ERA",
    studioBannerSub: "Instellingen afgestemd op het karakter van het tijdperk — pas gerust alles aan.",
  },
  ua: {
    brand: "Groua Era · Nostalgia Engine",
    enterTitle: "Увійди в епоху",
    entrySubtitle: "Обери час, у який хочеш зануритися — музика забере тебе в подорож.",
    allEras: "Усі епохи →",
    hubSubtitle: "Не просто наступний трек — обери час, у який хочеш зануритися, і музика забере тебе в подорож.",
    journey: "Подорож крізь час — від 70-х до сьогодні",
    dnaTitle: "Твоє Nostalgia DNA",
    dnaSub: "З чого насправді складається твій смак — пораховано з історії прослуховувань.",
    hubFooter: "Ти не жив у 1987? Не біда — ти все одно можеш його відкрити. Кожна епоха — це Сучасні виконавці + AI ERA.",
    back: "Усі епохи",
    aboutTitle: "Про епоху",
    soundmarksLabel: "Характерне звучання",
    contextLabel: "Контекст",
    artistsLabel: "Відомі виконавці епохи",
    artistsNote: "Для історичного контексту. GrouAI грає власний каталог і музику AI у дусі епохи — не відтворює й не імітує цих виконавців.",
    didYouKnowLabel: "Чи знаєш ти, що…",
    factLoading: "свіжий факт від AI…",
    factTagAI: "факт AI",
    factTagStatic: "GrouAI",
    refresh: "Новий",
    nowTitle: "Звучить як ця епоха",
    nowSub: "Сучасні виконавці, що тримають цей саунд — із живого каталогу GrouAI",
    aiTitle: "AI ERA",
    aiSub: "Нова музика AI у характері епохи — стиль епохи, а не особи",
    play: "Відтворити",
    shuffle: "Випадково",
    nowEmpty: "Немає збігів у каталозі — спробуй сусідню епоху або створи це звучання з AI нижче.",
    aiEmpty: "Ще ніхто не створив цю епоху з AI. Будь першим 👇",
    createInAI: "Створи цей рік з AI — як би він звучав, якби існував AI",
    loading: "Завантаження…",
    studioBannerTitle: "Ти створюєш епоху: GROUA ERA",
    studioBannerSub: "Налаштування підібрані під характер епохи — можеш будь-що змінити.",
  },
};

// Tłumaczenia treści epok (EN/NL/UA). PL bierzemy z eraEngine (fallback).
type EraTextMap = Record<string, Partial<EraText>>;

const EN: EraTextMap = {
  "1970s": { tagline: "Analog soul", vibe: "Warm, analog live playing — groove, funk and disco.", description: "The golden era of disco, funk and soul — live recordings, orchestral arrangements and groove as a religion. Also the rise of reggae and classic rock. Music was warm, analog and made to dance.", soundmarks: ["orchestral disco", "wah-wah guitar", "slap bass", "backing vocals", "vinyl"], culture: [{ label: "Fashion", value: "flares, afro, glam" }, { label: "Technology", value: "vinyl, cassette tape" }, { label: "Film", value: "Saturday Night Fever" }, { label: "Culture", value: "disco clubs, Studio 54" }], didYouKnow: "Studio 54 in New York became the global symbol of disco nightlife." },
  "1980s": { tagline: "Neon synth", vibe: "Neon synths, huge drums and a romantic glow.", description: "A decade of synthesizers, drum machines and MTV. Synth-pop, new wave and glam metal ruled the charts while hip-hop was just taking off. Big sound, gated reverb and a romantic neon glow.", soundmarks: ["analog synthesizers", "gated reverb snare", "drum machine (LinnDrum)", "MTV music video"], culture: [{ label: "Fashion", value: "neon, leather jacket, big hair" }, { label: "Technology", value: "Walkman, CD debut, first PCs" }, { label: "Film", value: "Blade Runner, Back to the Future" }, { label: "Games", value: "arcades, NES" }], didYouKnow: "MTV's 1981 launch turned music into a visual experience — the video became a must." },
  "1990s": { tagline: "Raw and full-throttle", vibe: "Raw energy — boom-bap, grunge, rave and eurodance.", description: "Grunge and hip-hop redefine the mainstream while rave, techno and eurodance explode across Europe. Raw energy, samples and breakbeats, a world on cassettes and VHS. Music became rebellious and direct.", soundmarks: ["boom-bap samples", "acid 303", "breakbeats", "grunge guitar", "eurodance synth"], culture: [{ label: "Fashion", value: "flannel, tracksuits, boots" }, { label: "Technology", value: "internet, CD, Discman" }, { label: "Film", value: "The Matrix, Pulp Fiction" }, { label: "Games", value: "PlayStation, Nintendo 64" }], didYouKnow: "Rave and free-party culture shaped Europe's club scene for decades to come." },
  "y2k": { tagline: "Chrome dream", vibe: "Shiny turn-of-the-millennium pop and euphoric trance.", description: "The turn of the millennium — shiny pop, R&B and euphoric trance. Chrome, silver and early-internet aesthetics, with auto-tune entering for good. The world believed the future had just begun.", soundmarks: ["digital synths", "auto-tune", "trance lead (supersaw)", "polished bass"], culture: [{ label: "Fashion", value: "metallic fabrics, low-rise jeans" }, { label: "Technology", value: "MP3, Napster, polyphonic phones" }, { label: "Film", value: "The Matrix Reloaded, Gladiator" }, { label: "Culture", value: "MSN Messenger, forums, blogs" }], didYouKnow: "The Y2K bug scare gave the whole turn-of-the-millennium aesthetic its name." },
  "2000s": { tagline: "Digital pop", vibe: "Bold digital pop, electro and rising indie.", description: "Electro-pop, indie and hip-hop rule as music moves online — the iPod, YouTube and MySpace change everything. Bold digital sound, club shine and the first big internet stars.", soundmarks: ["electro synths", "808", "sidechain pump", "indie guitar", "digital production"], culture: [{ label: "Fashion", value: "skinny jeans, indie sleaze" }, { label: "Technology", value: "iPod, YouTube (2005), MySpace" }, { label: "Film", value: "The Dark Knight" }, { label: "Games", value: "Wii, Xbox 360" }], didYouKnow: "MySpace launched a whole generation of bands before the labels did." },
  "2010s": { tagline: "Streaming era", vibe: "Festival drops, trap and playlist-written pop.", description: "EDM conquers stadiums, trap becomes the language of pop, and Spotify changes how we listen. Festival drops and tracks written for playlists — a hit is something that stops the scrolling thumb.", soundmarks: ["EDM / big-room drop", "future bass", "trap hi-hats", "vocal chops"], culture: [{ label: "Fashion", value: "streetwear, hype culture" }, { label: "Technology", value: "smartphone, Spotify, late-decade: TikTok" }, { label: "Film", value: "Marvel MCU" }, { label: "Culture", value: "memes, influencers, festivals" }], didYouKnow: "Streaming (Spotify) redefined what the word hit even means." },
  "now": { label: "NOW", tagline: "Today", vibe: "Music people make right now — the entire living GrouAI catalog.", description: "The music people make right now — genres blend without borders and AI tools open creation to everyone. It's the entire living GrouAI catalog: you and the community.", soundmarks: ["genre hybrids", "hyperpop", "drill", "afrobeats", "bedroom-pop"], culture: [{ label: "Technology", value: "AI, spatial audio, TikTok" }, { label: "Culture", value: "independent creators" }, { label: "Tools", value: "GrouAI Studio, tracks in minutes" }], didYouKnow: "For the first time in history, anyone can produce a finished track in minutes." },
  "future": { label: "FUTURE", tagline: "Tomorrow", vibe: "Immersive, spatial sound of tomorrow — made with AI.", description: "Immersive, spatial sound created with AI — music reacts to mood, generative layers and 3D audio. This is where GrouAI composes a tomorrow you haven't heard yet.", soundmarks: ["AI textures", "spatial audio", "generative pads", "granular bass"], culture: [{ label: "Technology", value: "generative AI, VR/AR, spatial" }, { label: "Culture", value: "adaptive music" }, { label: "Experience", value: "sound that reacts to you" }], didYouKnow: "Generative music can adapt to your mood in real time." },
};

const NL: EraTextMap = {
  "1970s": { tagline: "Analoge ziel", vibe: "Warm, analoog livespel — groove, funk en disco.", description: "Het gouden tijdperk van disco, funk en soul — live-opnames, orkestrale arrangementen en groove als religie. Ook de opkomst van reggae en klassieke rock. Muziek was warm, analoog en om op te dansen.", soundmarks: ["orkestrale disco", "wah-wah-gitaar", "slapbas", "achtergrondzang", "vinyl"], culture: [{ label: "Mode", value: "wijde pijpen, afro, glam" }, { label: "Technologie", value: "vinyl, cassettebandje" }, { label: "Film", value: "Saturday Night Fever" }, { label: "Cultuur", value: "discoclubs, Studio 54" }], didYouKnow: "Studio 54 in New York werd het wereldwijde symbool van het disco-nachtleven." },
  "1980s": { tagline: "Neon-synth", vibe: "Neon-synths, enorme drums en een romantische gloed.", description: "Een decennium van synthesizers, drumcomputers en MTV. Synth-pop, new wave en glam metal heersten, terwijl hip-hop net opkwam. Groot geluid, gated reverb en een romantische neongloed.", soundmarks: ["analoge synthesizers", "gated reverb snare", "drumcomputer (LinnDrum)", "MTV-videoclip"], culture: [{ label: "Mode", value: "neon, leren jack, big hair" }, { label: "Technologie", value: "Walkman, cd-debuut, eerste pc's" }, { label: "Film", value: "Blade Runner, Back to the Future" }, { label: "Games", value: "arcades, NES" }], didYouKnow: "De start van MTV in 1981 maakte muziek tot een visuele ervaring — de clip werd een must." },
  "1990s": { tagline: "Rauw en vol gas", vibe: "Rauwe energie — boom-bap, grunge, rave en eurodance.", description: "Grunge en hip-hop herdefiniëren de mainstream terwijl rave, techno en eurodance door Europa exploderen. Rauwe energie, samples en breakbeats, een wereld op cassettes en VHS. Muziek werd rebels en direct.", soundmarks: ["boom-bap samples", "acid 303", "breakbeats", "grunge-gitaar", "eurodance-synth"], culture: [{ label: "Mode", value: "flanel, trainingspakken, boots" }, { label: "Technologie", value: "internet, cd, Discman" }, { label: "Film", value: "The Matrix, Pulp Fiction" }, { label: "Games", value: "PlayStation, Nintendo 64" }], didYouKnow: "Rave- en free-partycultuur vormde decennialang de Europese clubscene." },
  "y2k": { tagline: "Chromen droom", vibe: "Glanzende millenniumpop en euforische trance.", description: "De eeuwwisseling — glanzende pop, R&B en euforische trance. Chroom, zilver en vroeg-internet-esthetiek, met auto-tune die definitief zijn intrede doet. De wereld geloofde dat de toekomst net was begonnen.", soundmarks: ["digitale synths", "auto-tune", "trance-lead (supersaw)", "gepolijste bas"], culture: [{ label: "Mode", value: "metallic stoffen, low-rise jeans" }, { label: "Technologie", value: "MP3, Napster, polyfone telefoons" }, { label: "Film", value: "The Matrix Reloaded, Gladiator" }, { label: "Cultuur", value: "MSN Messenger, forums, blogs" }], didYouKnow: "De Y2K-bug-paniek gaf de hele millenniumesthetiek zijn naam." },
  "2000s": { tagline: "Digitale pop", vibe: "Gedurfde digitale pop, electro en opkomende indie.", description: "Electro-pop, indie en hip-hop heersen terwijl muziek online gaat — de iPod, YouTube en MySpace veranderen alles. Gedurfd digitaal geluid, clubglans en de eerste grote internetsterren.", soundmarks: ["electro-synths", "808", "sidechain-pomp", "indie-gitaar", "digitale productie"], culture: [{ label: "Mode", value: "skinny jeans, indie sleaze" }, { label: "Technologie", value: "iPod, YouTube (2005), MySpace" }, { label: "Film", value: "The Dark Knight" }, { label: "Games", value: "Wii, Xbox 360" }], didYouKnow: "MySpace lanceerde een hele generatie bands vóór de platenlabels." },
  "2010s": { tagline: "Streaming-tijdperk", vibe: "Festivaldrops, trap en op playlists geschreven pop.", description: "EDM verovert stadions, trap wordt de taal van pop, en Spotify verandert hoe we luisteren. Festivaldrops en nummers geschreven voor playlists — een hit stopt je scrollende duim.", soundmarks: ["EDM / big-room drop", "future bass", "trap hi-hats", "vocal chops"], culture: [{ label: "Mode", value: "streetwear, hypecultuur" }, { label: "Technologie", value: "smartphone, Spotify, eind decennium: TikTok" }, { label: "Film", value: "Marvel MCU" }, { label: "Cultuur", value: "memes, influencers, festivals" }], didYouKnow: "Streaming (Spotify) herdefinieerde wat het woord hit überhaupt betekent." },
  "now": { label: "NOW", tagline: "Vandaag", vibe: "Muziek die mensen nu maken — de hele levende GrouAI-catalogus.", description: "De muziek die mensen nu maken — genres mengen zonder grenzen en AI-tools openen creatie voor iedereen. Het is de hele levende GrouAI-catalogus: jij en de community.", soundmarks: ["genrehybrides", "hyperpop", "drill", "afrobeats", "bedroom-pop"], culture: [{ label: "Technologie", value: "AI, spatial audio, TikTok" }, { label: "Cultuur", value: "onafhankelijke makers" }, { label: "Tools", value: "GrouAI Studio, tracks in minuten" }], didYouKnow: "Voor het eerst in de geschiedenis kan iedereen in minuten een afgewerkte track maken." },
  "future": { label: "FUTURE", tagline: "Morgen", vibe: "Immersief, ruimtelijk geluid van morgen — gemaakt met AI.", description: "Immersief, ruimtelijk geluid gemaakt met AI — muziek reageert op stemming, generatieve lagen en 3D-audio. Hier componeert GrouAI een morgen die je nog niet hebt gehoord.", soundmarks: ["AI-texturen", "spatial audio", "generatieve pads", "granulaire bas"], culture: [{ label: "Technologie", value: "generatieve AI, VR/AR, spatial" }, { label: "Cultuur", value: "adaptieve muziek" }, { label: "Ervaring", value: "geluid dat op jou reageert" }], didYouKnow: "Generatieve muziek kan zich in real time aan je stemming aanpassen." },
};

const UA: EraTextMap = {
  "1970s": { tagline: "Аналогова душа", vibe: "Тепла, аналогова гра наживо — грув, фанк і диско.", description: "Золота ера диско, фанку й соулу — живі записи, оркестрові аранжування, грув як релігія. Також розквіт реггі та класичного року. Музика була теплою, аналоговою й танцювальною.", soundmarks: ["оркестрове диско", "гітара вау-вау", "слеп-бас", "бек-вокал", "вініл"], culture: [{ label: "Мода", value: "кльош, афро, глем" }, { label: "Технології", value: "вініл, касетний магнітофон" }, { label: "Кіно", value: "Лихоманка суботнього вечора" }, { label: "Культура", value: "диско-клуби, Studio 54" }], didYouKnow: "Studio 54 у Нью-Йорку став світовим символом нічної диско-культури." },
  "1980s": { tagline: "Неоновий синт", vibe: "Неонові синтезатори, величезні барабани й романтичне сяйво.", description: "Десятиліття синтезаторів, драм-машин і MTV. Синт-поп, нью-вейв і глем-метал панували, а гіп-гоп щойно зароджувався. Великий звук, gated reverb і романтичне неонове сяйво.", soundmarks: ["аналогові синтезатори", "gated reverb на снері", "драм-машина (LinnDrum)", "відеокліп MTV"], culture: [{ label: "Мода", value: "неон, шкірянка, big hair" }, { label: "Технології", value: "Walkman, дебют CD, перші ПК" }, { label: "Кіно", value: "Той, що біжить лезом; Назад у майбутнє" }, { label: "Ігри", value: "аркади, NES" }], didYouKnow: "Запуск MTV у 1981 перетворив музику на візуальний досвід — кліп став обовʼязковим." },
  "1990s": { tagline: "Сиро й на максимум", vibe: "Сира енергія — бум-бап, ґрандж, рейв та євроденс.", description: "Ґрандж і гіп-гоп переосмислюють мейнстрім, а Європою вибухають рейв, техно та євроденс. Сира енергія, семпли та брейкбіти, світ на касетах і VHS. Музика стала бунтівною й прямою.", soundmarks: ["бум-бап семпли", "acid 303", "брейкбіти", "ґрандж-гітара", "євроденс-синт"], culture: [{ label: "Мода", value: "фланель, спортивні костюми, берці" }, { label: "Технології", value: "інтернет, CD, Discman" }, { label: "Кіно", value: "Матриця, Кримінальне чтиво" }, { label: "Ігри", value: "PlayStation, Nintendo 64" }], didYouKnow: "Культура рейвів і вільних вечірок сформувала клубну сцену Європи на десятиліття." },
  "y2k": { tagline: "Хромована мрія", vibe: "Блискучий поп межі тисячоліть та ейфорійний транс.", description: "Межа тисячоліть — блискучий поп, R&B та ейфорійний транс. Естетика хрому, срібла й раннього інтернету, а авто-тюн входить у гру назавжди. Світ вірив, що майбутнє щойно почалося.", soundmarks: ["цифрові синти", "авто-тюн", "транс-лід (supersaw)", "відшліфований бас"], culture: [{ label: "Мода", value: "металеві тканини, низька посадка" }, { label: "Технології", value: "MP3, Napster, поліфонічні телефони" }, { label: "Кіно", value: "Матриця: Перезавантаження, Гладіатор" }, { label: "Культура", value: "MSN Messenger, форуми, блоги" }], didYouKnow: "Паніка через баг 2000 року (Y2K) дала назву всій естетиці межі тисячоліть." },
  "2000s": { tagline: "Цифровий поп", vibe: "Сміливий цифровий поп, електро та висхідний інді.", description: "Електро-поп, інді та гіп-гоп панують, а музика переходить онлайн — iPod, YouTube і MySpace змінюють усе. Сміливий цифровий звук, клубний блиск і перші великі зірки інтернету.", soundmarks: ["електро-синти", "808", "сайдчейн-помпа", "інді-гітара", "цифрове продюсування"], culture: [{ label: "Мода", value: "скіні, indie sleaze" }, { label: "Технології", value: "iPod, YouTube (2005), MySpace" }, { label: "Кіно", value: "Темний лицар" }, { label: "Ігри", value: "Wii, Xbox 360" }], didYouKnow: "MySpace запустив ціле покоління гуртів раніше за лейбли." },
  "2010s": { tagline: "Ера стримінгу", vibe: "Фестивальні дропи, треп і поп, писаний під плейлисти.", description: "EDM підкорює стадіони, треп стає мовою попу, а Spotify змінює те, як ми слухаємо. Фестивальні дропи й треки, писані під плейлисти — хіт це те, що зупиняє палець у стрічці.", soundmarks: ["EDM / big-room дроп", "future bass", "треп хай-хети", "vocal chops"], culture: [{ label: "Мода", value: "стрітвер, hype-культура" }, { label: "Технології", value: "смартфон, Spotify, кінець декади: TikTok" }, { label: "Кіно", value: "Marvel MCU" }, { label: "Культура", value: "меми, інфлюенсери, фестивалі" }], didYouKnow: "Стримінг (Spotify) переосмислив саме значення слова хіт." },
  "now": { label: "NOW", tagline: "Сьогодні", vibe: "Музика, яку люди створюють зараз — увесь живий каталог GrouAI.", description: "Музика, яку люди створюють зараз — жанри змішуються без меж, а інструменти AI відкривають творчість для кожного. Це весь живий каталог GrouAI: ти і спільнота.", soundmarks: ["жанрові гібриди", "гіперпоп", "дрилл", "афробітс", "bedroom-pop"], culture: [{ label: "Технології", value: "AI, spatial audio, TikTok" }, { label: "Культура", value: "незалежні творці" }, { label: "Інструменти", value: "GrouAI Studio, треки за хвилини" }], didYouKnow: "Уперше в історії кожен може створити готовий трек за лічені хвилини." },
  "future": { label: "FUTURE", tagline: "Завтра", vibe: "Занурливе, просторове звучання завтра — створене з AI.", description: "Занурливе, просторове звучання, створене з AI — музика реагує на настрій, генеративні шари та 3D-звук. Тут GrouAI компонує завтра, якого ти ще не чув.", soundmarks: ["текстури AI", "spatial audio", "генеративні педи", "гранулярний бас"], culture: [{ label: "Технології", value: "генеративний AI, VR/AR, spatial" }, { label: "Культура", value: "адаптивна музика" }, { label: "Досвід", value: "звук, що реагує на тебе" }], didYouKnow: "Генеративна музика може підлаштовуватися під твій настрій у реальному часі." },
};

const ERA_TEXT: Partial<Record<Language, EraTextMap>> = { en: EN, nl: NL, ua: UA };

// Zwraca zlokalizowany tekst epoki. PL = pola z eraEngine (fallback dla braków).
export function eraTextFor(era: Era, lang: Language): EraText {
  const base: EraText = {
    label: era.label, tagline: era.tagline, vibe: era.vibe, description: era.description,
    soundmarks: era.soundmarks, culture: era.culture, didYouKnow: era.didYouKnow,
  };
  if (lang === "pl") return base;
  const o = ERA_TEXT[lang]?.[era.key];
  return o ? { ...base, ...o } : base;
}

export function eraUi(lang: Language, key: string): string {
  return ERA_UI[lang]?.[key] ?? ERA_UI.pl[key] ?? key;
}
