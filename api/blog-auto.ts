// Automatyczna redakcja bloga — „żywy algorytm”, BEZ płatnego AI.
// 1) Zbiera świeże wpisy z publicznych RSS: serwisy muzyczne/tech (EN), polskie, niderlandzkie, ukraińskie,
//    Google News w każdym języku, Hacker News (najwyżej punktowane).
// 2) Ocenia: trafność muzyka/AI/technologia, świeżość, ile źródeł i języków o tym pisze → wybiera NAJLEPSZY temat
//    (bez powtórek tematu z 2 dni i linków z 14 dni).
// 3) Redaguje artykuł w PL/EN/NL/UA — każda wersja z wiadomości w SWOIM języku (gdy za mało — źródła angielskie),
//    z redakcyjnym wstępem, „dlaczego to ważne”, „co to znaczy dla Ciebie” i listą źródeł (krótkie cytaty + linki).
// 4) Zapis w bazie sbmf (blog_auto_posts, RPC z sekretem). Blog pokazuje wersję w języku czytelnika.
// Drugi rodzaj (?kind=research): „Z biblioteki dźwięku” — nowe publikacje o muzyce i dźwięku (arXiv), prace doktorskie
// i artykuły naukowe (OpenAlex), nowe książki (Open Library). Rano wiadomości, po południu nauka.
// Cron: 2×/dzień (vercel.json). Najwyżej 2 artykuły na dobę. GET ?dry=1[&lang=pl] = podgląd bez zapisu. ?run=1 = ręcznie.
export const config = { runtime: "edge" };

type Lang = "pl" | "en" | "nl" | "ua";
type Item = { title: string; summary: string; url: string; source: string; lang: Lang; date: number; points: number; theme?: Theme; score?: number };
type Theme = "ai_music" | "streaming" | "gear" | "rights" | "live" | "creators" | "ai_tech" | "research";

const LANGS: Lang[] = ["pl", "en", "nl", "ua"];
const env = (k: string) => (((globalThis as any).process?.env?.[k] as string | undefined) || "").trim() || undefined;

const gn = (q: string, hl: string, gl: string, ceid: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

const FEEDS: Record<Lang, { url: string; source: string }[]> = {
  en: [
    { url: "https://www.musicbusinessworldwide.com/feed/", source: "Music Business Worldwide" },
    { url: "https://www.digitalmusicnews.com/feed/", source: "Digital Music News" },
    { url: "https://cdm.link/feed/", source: "CDM" },
    { url: "https://musictech.com/feed/", source: "MusicTech" },
    { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
    { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch" },
    { url: "https://hnrss.org/frontpage?points=150", source: "Hacker News" },
    { url: gn('"AI music" OR Suno OR Udio OR "music streaming" OR Spotify OR "music producers"', "en-US", "US", "US:en"), source: "" },
  ],
  pl: [
    { url: "https://spidersweb.pl/feed", source: "Spider's Web" },
    { url: "https://antyweb.pl/feed", source: "Antyweb" },
    { url: "https://www.chip.pl/feed", source: "CHIP" },
    { url: gn('muzyka AI OR "sztuczna inteligencja" muzyka OR Spotify OR streaming muzyki OR koncert OR festiwal', "pl", "PL", "PL:pl"), source: "" },
  ],
  nl: [
    { url: "https://feeds.feedburner.com/tweakers/mixed", source: "Tweakers" },
    { url: "https://www.nu.nl/rss/Tech", source: "NU.nl" },
    { url: gn('muziek AI OR Spotify OR streaming OR festival OR concert', "nl", "NL", "NL:nl"), source: "" },
  ],
  ua: [
    { url: "https://ain.ua/feed/", source: "AIN.UA" },
    { url: "https://mezha.media/feed/", source: "Mezha" },
    { url: gn('музика AI OR Spotify OR стрімінг OR концерт OR фестиваль', "uk", "UA", "UA:uk"), source: "" },
  ],
};

// ── Tematy ───────────────────────────────────────────────────────────────────
const THEME_KW: Record<Theme, RegExp> = {
  ai_music: /\b(ai music|ai[- ]generated (song|track|music)|suno|udio|stable audio|musicgen|lyria|voice clon|ai (singer|artist|band|vocals?)|deepfake (song|vocal))|muzyk\S* (ai|sztucz)|sztuczn\S* inteligencj\S* .{0,40}muzyk|muziek\S* .{0,20}\bai\b|\bai\b.{0,20}muziek|музик\S* .{0,25}(ai|ші|штучн)|(штучн|ші).{0,25}музик/i,
  streaming: /\b(spotify|apple music|deezer|tidal|youtube music|soundcloud|amazon music|streaming (service|platform|price|royalt)|royalt(y|ies)|payouts?)\b|stream\S* muzyk|tantiem|abonament\S* spotify|стрімінг|роялті/i,
  gear: /\b(synth(esizer)?s?|plugins?|daw|ableton|fl studio|logic pro|pro tools|midi|audio interface|headphones?|earbuds|speakers?|turntable|sampler|drum machine|moog|korg|roland|elektron|teenage engineering)\b|słuchawk|syntezator|głośnik|koptelefoon|speaker|навушник|синтезатор/i,
  rights: /\b(copyright|lawsuit|sued|licen[cs]e deal|labels?|umg|universal music|sony music|warner music|riaa|gema|zaiks|infring)\w*|praw\S* autorsk|pozew|auteursrecht|rechtszaak|авторськ\S* прав|позов/i,
  live: /\b(concerts?|festivals?|tour(ing)?|tickets?|live ?nation|ticketmaster|glastonbury|coachella|opener|open'er)\b|koncert|festiwal|trasa koncert|bilet|концерт|фестивал|тур\b/i,
  creators: /\b(tiktok|creators?|viral|shorts|reels|twitch|youtubers?|influencers?|fans?)\b|twórc|wiraln|makers?\b|контент-мейкер|блогер/i,
  research: /(?!)/,
  ai_tech: /\b(openai|chatgpt|gpt-\d|gemini|anthropic|claude|llm|nvidia|deepmind|mistral|meta ai|copilot|generative ai|agents?)\b|sztuczn\S* inteligencj|kunstmatige intelligentie|штучн\S* інтелект/i,
};
const MUSIC = /\b(music|song|album|artist|singer|band|producer|audio|sound|dj|beat|rap|hip-hop|vinyl|spotify|playlist|label|concert|festival|synth)\w*|muzyk|piosen|artyst|dźwięk|koncert|festiwal|muziek|nummer|artiest|geluid|музик|пісн|артист|звук|концерт/i;
const CAT: Record<Theme, string> = { research: "sound_chronicles", ai_music: "ai_news", streaming: "industry", gear: "tools", rights: "industry", live: "trends", creators: "trends", ai_tech: "tech_news" };
const THEME_W: Record<Theme, number> = { research: 0, ai_music: 1.5, streaming: 1.3, gear: 1.1, rights: 1.2, live: 1, creators: 0.9, ai_tech: 0.8 };

// ── RSS ──────────────────────────────────────────────────────────────────────
function decode(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;|&rsquo;/g, "’").replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…")
    .replace(/\s+/g, " ").trim();
}
const tag = (b: string, t: string) => { const m = b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i")); return m ? m[1] : ""; };

function parse(xml: string, lang: Lang, src: string): Item[] {
  const blocks = xml.includes("<item") ? xml.split(/<item[\s>]/i).slice(1) : xml.split(/<entry[\s>]/i).slice(1);
  const out: Item[] = [];
  for (const raw of blocks.slice(0, 40)) {
    const b = raw.split(/<\/(item|entry)>/i)[0] || "";
    let title = decode(tag(b, "title"));
    let link = decode(tag(b, "link"));
    if (!link) { const m = b.match(/<link[^>]+href="([^"]+)"/i); link = m ? m[1] : ""; }
    const desc = decode(tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content"));
    const when = Date.parse(decode(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date")));
    let source = src;
    if (!src) { // Google News: „Nagłówek - Źródło”
      const m = title.match(/^(.*\S)\s[-–—]\s([^-–—]{1,40})$/);
      if (m) { title = m[1]; source = m[2].trim(); } else source = "Google News";
    }
    const points = Number((desc.match(/Points:\s*(\d+)/i) || [])[1] || 0);
    if (!title || !/^https?:\/\//.test(link)) continue;
    let summary = desc.replace(/Article URL:.*$/i, "").replace(/The post .* appeared first on .*$/i, "").trim();
    if (!src || summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 30))) summary = summary.length > title.length + 20 ? summary : "";
    out.push({ title: title.slice(0, 180), summary, url: link, source, lang, date: Number.isFinite(when) ? when : Date.now(), points });
  }
  return out;
}

async function fetchFeed(url: string, lang: Lang, source: string): Promise<Item[]> {
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GrouAI-Blog/1.0; +https://grouaistream.com)" }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return [];
    return parse(await r.text(), lang, source);
  } catch { return []; }
}

// ── Nauka i książki ──────────────────────────────────────────────────────────
const UA_HDR = { "user-agent": "Mozilla/5.0 (compatible; GrouAI-Blog/1.0; +https://grouaistream.com)" };
const absFromInv = (inv?: Record<string, number[]>) => {
  if (!inv) return "";
  const w: string[] = [];
  for (const [word, pos] of Object.entries(inv)) for (const p of pos) w[p] = word;
  return w.filter(Boolean).join(" ");
};
async function openAlex(filter: string, label: string): Promise<Item[]> {
  try {
    const r = await fetch(`https://api.openalex.org/works?filter=${filter}&sort=publication_date:desc&per-page=15&select=id,doi,title,publication_date,abstract_inverted_index,primary_location,authorships`, { headers: UA_HDR, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { results?: any[] };
    return (j.results ?? []).filter((w) => w.title).map((w) => {
      const venue = w.primary_location?.source?.display_name as string | undefined;
      const authors = (w.authorships ?? []).slice(0, 2).map((a: any) => a.author?.display_name).filter(Boolean).join(", ");
      return { title: String(w.title).replace(/<[^>]+>/g, "").slice(0, 180), summary: absFromInv(w.abstract_inverted_index).slice(0, 900),
        url: w.doi || w.primary_location?.landing_page_url || w.id, source: `${label}${venue ? ` · ${venue}` : ""}${authors ? ` · ${authors}` : ""}`.slice(0, 90),
        lang: "en" as Lang, date: Date.parse(w.publication_date) || Date.now(), points: 0 };
    });
  } catch { return []; }
}
async function openLibrary(): Promise<Item[]> {
  try {
    const r = await fetch("https://openlibrary.org/search.json?q=subject%3Amusic&sort=new&limit=25&fields=key,title,author_name,first_publish_year,subject", { headers: UA_HDR, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = (await r.json()) as { docs?: any[] };
    const year = new Date().getFullYear();
    return (j.docs ?? []).filter((d) => d.title && (d.first_publish_year ?? 0) >= year - 1).map((d) => ({
      title: String(d.title).slice(0, 160), summary: (d.subject ?? []).slice(0, 6).join(", "),
      url: `https://openlibrary.org${d.key}`, source: `📚 ${(d.author_name ?? ["Open Library"]).slice(0, 2).join(", ")}`.slice(0, 80),
      lang: "en" as Lang, date: Date.UTC(d.first_publish_year ?? year, 0, 1), points: 0 }));
  } catch { return []; }
}
async function fetchResearch(): Promise<Item[]> {
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const [sd, as, theses, papers, books] = await Promise.all([
    fetchFeed("https://rss.arxiv.org/rss/cs.SD", "en", "📄 arXiv (cs.SD)"),
    fetchFeed("https://rss.arxiv.org/rss/eess.AS", "en", "📄 arXiv (eess.AS)"),
    openAlex(`type:dissertation,title_and_abstract.search:music,from_publication_date:${since}`, "🎓 Praca doktorska / PhD"),
    openAlex(`type:article,title_and_abstract.search:music%20cognition|music%20perception|music%20emotion|music%20information%20retrieval,from_publication_date:${since}`, "📄 Artykuł naukowy"),
    openLibrary(),
  ]);
  const arx = [...sd, ...as].map((i) => ({ ...i, summary: i.summary.replace(/^.*?Abstract:\s*/i, "") }))
    .filter((i) => /music|song|singing|melod|chord|rhythm|beat|instrument|timbre|genre|composer|audio generation|symbolic/i.test(`${i.title} ${i.summary}`));
  const MUS = /music|song|sing|melod|harmon|rhythm|composer|instrument|listen|concert|opera|jazz|hip-hop|sound/i;
  return [...arx, ...theses, ...papers.filter((p) => MUS.test(p.title + p.summary)), ...books].map((i) => {
    const ageD = (Date.now() - i.date) / 864e5;
    const kindBoost = /Praca doktorska/.test(i.source) ? 3 : /📚/.test(i.source) ? 2 : 1.5;
    return { ...i, theme: "research" as Theme, score: kindBoost + (i.summary.length > 200 ? 2 : 0) + Math.max(0, 3 - ageD / 20) + (/music/i.test(i.title) ? 2 : 0) };
  });
}

// ── Ocena ────────────────────────────────────────────────────────────────────
function classify(it: Item): Item | null {
  const text = `${it.title} ${it.summary}`;
  let best: Theme | null = null, hits = 0;
  for (const th of Object.keys(THEME_KW) as Theme[]) {
    const m = text.match(new RegExp(THEME_KW[th].source, "gi"));
    const n = m ? m.length * THEME_W[th] : 0;
    if (n > hits) { hits = n; best = th; }
  }
  if (!best) return null;
  const music = MUSIC.test(text);
  if (best === "ai_tech" && !music && it.points < 200) hits *= 0.6; // blog jest o muzyce i technologii
  if ((best === "live" || best === "creators") && !music) return null;
  const ageH = (Date.now() - it.date) / 3.6e6;
  if (ageH > 24 * 7 || ageH < -2) return null;
  const fresh = Math.max(0, 4 - ageH / 18);
  return { ...it, theme: best, score: hits * 3 + (music ? 4 : 0) + fresh + Math.min(3, it.points / 120) + (it.summary ? 1 : 0) };
}

const norm = (u: string) => u.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

// ── Teksty redakcyjne (PL/EN/NL/UA) ──────────────────────────────────────────
const H: Record<Lang, { what: string; also: string; why: string; you: string; src: string; note: string; read: string }> = {
  pl: { what: "Co się wydarzyło", also: "W tle", why: "Dlaczego to ważne", you: "Co to znaczy dla Ciebie", src: "Źródła", read: "czytaj", note: "Artykuł przygotowała redakcja automatyczna GrouAI na podstawie publicznych źródeł (bez płatnego AI). Cytaty są skrócone — pełne teksty pod linkami." },
  en: { what: "What happened", also: "Also in the mix", why: "Why it matters", you: "What it means for you", src: "Sources", read: "read", note: "Prepared by the GrouAI automated newsroom from public sources (no paid AI). Quotes are shortened — full stories at the links." },
  nl: { what: "Wat er gebeurde", also: "Ook in het nieuws", why: "Waarom het ertoe doet", you: "Wat het voor jou betekent", src: "Bronnen", read: "lees", note: "Samengesteld door de automatische GrouAI-redactie uit openbare bronnen (zonder betaalde AI). Citaten zijn ingekort — volledige artikelen via de links." },
  ua: { what: "Що сталося", also: "Також у фокусі", why: "Чому це важливо", you: "Що це означає для тебе", src: "Джерела", read: "читати", note: "Статтю підготувала автоматична редакція GrouAI на основі відкритих джерел (без платного AI). Цитати скорочено — повні тексти за посиланнями." },
};

const KICKER: Record<Theme, Record<Lang, string>> = {
  ai_music: { pl: "Muzyka × AI", en: "Music × AI", nl: "Muziek × AI", ua: "Музика × AI" },
  streaming: { pl: "Streaming", en: "Streaming", nl: "Streaming", ua: "Стрімінг" },
  gear: { pl: "Sprzęt i studio", en: "Gear & studio", nl: "Gear & studio", ua: "Техніка і студія" },
  rights: { pl: "Prawo i branża", en: "Rights & industry", nl: "Recht & industrie", ua: "Право й індустрія" },
  live: { pl: "Na żywo", en: "Live", nl: "Live", ua: "Наживо" },
  creators: { pl: "Twórcy", en: "Creators", nl: "Makers", ua: "Творці" },
  ai_tech: { pl: "AI i technologia", en: "AI & tech", nl: "AI & tech", ua: "AI і технології" },
  research: { pl: "Z biblioteki dźwięku", en: "From the sound library", nl: "Uit de geluidsbibliotheek", ua: "З бібліотеки звуку" },
};

const FALLBACK_TITLE: Record<Theme, Record<Lang, string>> = {
  ai_music: { pl: "AI w muzyce: najważniejsze ruchy tygodnia", en: "AI in music: the moves that matter this week", nl: "AI in muziek: de belangrijkste zetten van de week", ua: "AI у музиці: головні події тижня" },
  streaming: { pl: "Streaming muzyki: co się zmienia dla słuchaczy i artystów", en: "Music streaming: what's changing for listeners and artists", nl: "Muziekstreaming: wat er verandert voor luisteraars en artiesten", ua: "Музичний стрімінг: що змінюється для слухачів і артистів" },
  gear: { pl: "Nowy sprzęt i narzędzia dla producentów", en: "New gear and tools for producers", nl: "Nieuwe gear en tools voor producers", ua: "Нова техніка та інструменти для продюсерів" },
  rights: { pl: "Prawa autorskie i branża muzyczna: co się dzieje", en: "Copyright and the music business: what's going on", nl: "Auteursrecht en de muziekindustrie: wat er speelt", ua: "Авторське право і музична індустрія: що відбувається" },
  live: { pl: "Koncerty i festiwale: o czym mówi scena", en: "Concerts and festivals: what the scene is talking about", nl: "Concerten en festivals: waar de scene het over heeft", ua: "Концерти й фестивалі: про що говорить сцена" },
  creators: { pl: "Twórcy i fani: nowe zasady gry", en: "Creators and fans: the new rules of the game", nl: "Makers en fans: de nieuwe spelregels", ua: "Творці й фанати: нові правила гри" },
  research: { pl: "Nauka o muzyce: nowe badania, prace doktorskie i książki", en: "Music science: new research, PhD theses and books", nl: "Muziekwetenschap: nieuw onderzoek, proefschriften en boeken", ua: "Наука про музику: нові дослідження, дисертації й книжки" },
  ai_tech: { pl: "AI i technologia: co warto wiedzieć", en: "AI and tech: what's worth knowing", nl: "AI en tech: wat je moet weten", ua: "AI і технології: що варто знати" },
};

const INTRO: Record<Theme, Record<Lang, string[]>> = {
  ai_music: {
    pl: ["Sztuczna inteligencja coraz śmielej wchodzi do studia — i tym razem nie chodzi tylko o ciekawostki.", "Granica między narzędziem a współautorem znów się przesunęła. Oto, co wydarzyło się na styku muzyki i AI."],
    en: ["AI keeps moving deeper into the studio — and this time it's more than a novelty.", "The line between tool and co-writer just moved again. Here's what happened where music meets AI."],
    nl: ["AI schuift steeds verder de studio in — en dit keer is het meer dan een gimmick.", "De grens tussen gereedschap en co-auteur is weer verschoven. Dit gebeurde er waar muziek en AI elkaar raken."],
    ua: ["Штучний інтелект дедалі глибше заходить у студію — і цього разу це не просто цікавинка.", "Межа між інструментом і співавтором знову зсунулася. Ось що сталося на стику музики та AI."],
  },
  streaming: {
    pl: ["Streaming to dziś główna scena muzyki — a jej zasady wciąż się zmieniają.", "Ceny, wypłaty, algorytmy: w streamingu znów jest ruch, który odczują i słuchacze, i artyści."],
    en: ["Streaming is music's main stage — and its rules keep shifting.", "Prices, payouts, algorithms: streaming is moving again, and both listeners and artists will feel it."],
    nl: ["Streaming is het hoofdpodium van muziek — en de regels blijven veranderen.", "Prijzen, uitbetalingen, algoritmes: er is weer beweging in streaming, voor luisteraars én artiesten."],
    ua: ["Стрімінг — головна сцена музики, і його правила постійно змінюються.", "Ціни, виплати, алгоритми: у стрімінгу знову рух, який відчують і слухачі, і артисти."],
  },
  gear: {
    pl: ["Dobre narzędzie potrafi zmienić brzmienie całej płyty. Sprawdzamy, co nowego trafia do studiów.", "Od wtyczek po słuchawki — przegląd sprzętu, o którym właśnie mówią producenci."],
    en: ["The right tool can change the sound of a whole record. Here's what's landing in studios.", "From plugins to headphones — the gear producers are talking about right now."],
    nl: ["Het juiste gereedschap kan de sound van een hele plaat veranderen. Dit belandt nu in studio's.", "Van plugins tot koptelefoons — de gear waar producers het nu over hebben."],
    ua: ["Правильний інструмент здатен змінити звучання цілого альбому. Що нового з'являється в студіях.", "Від плагінів до навушників — техніка, про яку зараз говорять продюсери."],
  },
  rights: {
    pl: ["Za każdym utworem stoją prawa — a teraz toczy się o nie gra na nowych zasadach.", "Wytwórnie, sądy i licencje: w branży muzycznej zapadają decyzje, które ustawią rynek na lata."],
    en: ["Behind every track there are rights — and the game around them is being rewritten.", "Labels, courts and licences: the music business is making calls that will shape the market for years."],
    nl: ["Achter elk nummer zitten rechten — en het spel daaromheen wordt herschreven.", "Labels, rechtbanken en licenties: de muziekindustrie neemt besluiten die de markt jarenlang vormen."],
    ua: ["За кожним треком стоять права — і гра навколо них переписується.", "Лейбли, суди й ліцензії: індустрія ухвалює рішення, що визначать ринок на роки."],
  },
  live: {
    pl: ["Muzyka na żywo wciąż daje to, czego nie da żaden algorytm. Oto, czym żyje scena.", "Koncerty, festiwale, bilety — najważniejsze wieści z życia sceny."],
    en: ["Live music still delivers what no algorithm can. Here's what the scene is buzzing about.", "Concerts, festivals, tickets — the key news from life on stage."],
    nl: ["Live muziek geeft nog steeds wat geen algoritme kan. Dit houdt de scene bezig.", "Concerten, festivals, tickets — het belangrijkste nieuws van het podium."],
    ua: ["Жива музика досі дає те, чого не дасть жоден алгоритм. Ось чим живе сцена.", "Концерти, фестивалі, квитки — головні новини зі сцени."],
  },
  creators: {
    pl: ["Hit rodzi się dziś w 15 sekund wideo. Sprawdzamy, jak zmienia się droga od twórcy do fana.", "Platformy, fani, zasięgi — co nowego w świecie twórców muzyki."],
    en: ["Today a hit is born in a 15-second clip. Here's how the path from creator to fan is changing.", "Platforms, fans, reach — what's new in the world of music creators."],
    nl: ["Een hit ontstaat vandaag in een clip van 15 seconden. Zo verandert de weg van maker naar fan.", "Platforms, fans, bereik — wat er nieuw is voor muziekmakers."],
    ua: ["Сьогодні хіт народжується в 15-секундному відео. Як змінюється шлях від творця до фаната.", "Платформи, фанати, охоплення — що нового у світі музичних творців."],
  },
  research: {
    pl: ["Zanim coś trafi do aplikacji i na listy przebojów, ktoś to najpierw zbada. Zaglądamy do najnowszych publikacji, prac doktorskich i książek o muzyce.", "Muzyka to także nauka — o mózgu, emocjach, dźwięku i algorytmach. Oto, co nowego piszą badacze i autorzy."],
    en: ["Before something reaches apps and charts, someone researches it first. We dip into the latest papers, PhD theses and books on music.", "Music is science too — of the brain, emotion, sound and algorithms. Here's what researchers and authors are publishing."],
    nl: ["Voordat iets in apps en hitlijsten belandt, onderzoekt iemand het eerst. We duiken in de nieuwste papers, proefschriften en boeken over muziek.", "Muziek is ook wetenschap — over het brein, emotie, geluid en algoritmes. Dit publiceren onderzoekers en auteurs nu."],
    ua: ["Перш ніж щось потрапить у застосунки й чарти, хтось це досліджує. Зазираємо в нові публікації, дисертації та книжки про музику.", "Музика — це й наука: про мозок, емоції, звук і алгоритми. Ось що нового пишуть дослідники й автори."],
  },
  ai_tech: {
    pl: ["Technologia, która dziś trafia na nagłówki, jutro będzie w Twoim telefonie — i w Twojej muzyce.", "Najważniejsze ruchy w AI i technologii — z myślą o tym, co zmienią w dźwięku."],
    en: ["The tech making headlines today will be in your phone tomorrow — and in your music.", "The key moves in AI and tech — with an eye on what they'll change in sound."],
    nl: ["De tech die vandaag de krant haalt, zit morgen in je telefoon — en in je muziek.", "De belangrijkste zetten in AI en tech — met oog voor wat ze in geluid veranderen."],
    ua: ["Технології, що сьогодні в заголовках, завтра будуть у твоєму телефоні — і в твоїй музиці.", "Головні кроки в AI та технологіях — з думкою про те, що вони змінять у звуці."],
  },
};

const WHY: Record<Theme, Record<Lang, string[]>> = {
  ai_music: {
    pl: ["Narzędzia generatywne skracają drogę od pomysłu do gotowego demo z dni do minut. To nie zastępuje ucha i gustu — ale zmienia to, ile pomysłów da się sprawdzić w jeden wieczór.", "Najwięcej pytań dotyczy praw: na czym trenowano modele, kto jest autorem i jak oznaczać utwory z udziałem AI. Platformy i wytwórnie dopiero ustalają zasady, więc każdy taki ruch ma znaczenie dla całej branży.", "Dla słuchaczy liczy się efekt: więcej muzyki, szybciej i bardziej pod nastrój. Wygrają ci, którzy połączą możliwości AI z autentycznym, rozpoznawalnym brzmieniem."],
    en: ["Generative tools cut the path from idea to finished demo from days to minutes. They don't replace taste — but they change how many ideas you can test in one evening.", "Most questions are about rights: what models were trained on, who the author is, and how AI-assisted tracks should be labelled. Platforms and labels are still writing the rules, so every move like this matters.", "For listeners it's about the result: more music, faster, more tuned to mood. The winners will pair AI with an authentic, recognisable sound."],
    nl: ["Generatieve tools maken de weg van idee naar demo korter: van dagen naar minuten. Ze vervangen geen smaak, maar je test wel veel meer ideeën op één avond.", "De meeste vragen gaan over rechten: waarop zijn modellen getraind, wie is de maker en hoe label je nummers met AI? Platforms en labels schrijven de regels nog, dus elke zet telt.", "Voor luisteraars telt het resultaat: meer muziek, sneller, meer op maat van de stemming. Winnaars combineren AI met een echte, herkenbare sound."],
    ua: ["Генеративні інструменти скорочують шлях від ідеї до демо з днів до хвилин. Вони не замінюють смак, але дозволяють перевірити значно більше ідей за вечір.", "Найбільше питань — про права: на чому навчали моделі, хто автор і як позначати треки з AI. Платформи й лейбли ще пишуть правила, тож кожен такий крок важливий.", "Для слухачів важить результат: більше музики, швидше й під настрій. Виграють ті, хто поєднає AI з автентичним, впізнаваним звуком."],
  },
  streaming: {
    pl: ["Każda zmiana w cenniku czy algorytmie przekłada się na to, co słyszymy i ile zarabiają artyści. Przy milionach odtworzeń nawet ułamki centa robią różnicę.", "Platformy walczą o czas słuchacza: personalizacją, ekskluzywnymi treściami i nowymi formatami. To dobra wiadomość dla odkrywania muzyki — pod warunkiem że algorytm nie zamknie nas w bańce.", "Dla niezależnych twórców kluczowe są przejrzyste zasady wypłat i realna szansa na wejście do playlist. Dlatego warto śledzić każdą zmianę regulaminu."],
    en: ["Every change to pricing or the algorithm shapes what we hear and what artists earn. At millions of plays, fractions of a cent add up.", "Platforms are fighting for listening time with personalisation, exclusives and new formats. Good news for discovery — as long as the algorithm doesn't lock us in a bubble.", "For independent artists, transparent payout rules and a real shot at playlists are what matter. That's why every policy change is worth watching."],
    nl: ["Elke wijziging in prijs of algoritme bepaalt wat we horen en wat artiesten verdienen. Bij miljoenen streams tellen fracties van een cent.", "Platforms vechten om luistertijd met personalisatie, exclusives en nieuwe formats. Goed voor ontdekking — zolang het algoritme ons niet in een bubbel sluit.", "Voor onafhankelijke artiesten tellen heldere uitbetalingsregels en een eerlijke kans op playlists. Daarom is elke beleidswijziging het volgen waard."],
    ua: ["Кожна зміна цін чи алгоритму впливає на те, що ми чуємо і скільки заробляють артисти. На мільйонах прослуховувань навіть частки цента мають вагу.", "Платформи борються за час слухача персоналізацією, ексклюзивами й новими форматами. Це добре для відкриття музики — якщо алгоритм не замкне нас у бульбашці.", "Для незалежних артистів важливі прозорі правила виплат і реальний шанс потрапити в плейлисти. Тому варто стежити за кожною зміною правил."],
  },
  gear: {
    pl: ["Coraz więcej profesjonalnych funkcji trafia do tańszych urządzeń i wtyczek. Domowe studio może dziś brzmieć jak sala nagraniowa sprzed dekady.", "Inteligentne funkcje — automatyczny miks, separacja ścieżek, korekcja — przyspieszają pracę, ale najważniejsze decyzje wciąż podejmuje ucho producenta.", "Zanim kupisz nowy sprzęt, sprawdź, czy rozwiązuje Twój prawdziwy problem: czas, brzmienie czy wygodę pracy. Najlepsza inwestycja to ta, z której korzystasz codziennie."],
    en: ["More pro features are landing in cheaper devices and plugins. A home studio can now sound like a pro room from a decade ago.", "Smart features — auto-mixing, stem separation, correction — speed things up, but the key calls still come from the producer's ear.", "Before buying new gear, check it solves your real problem: time, sound or workflow. The best investment is the one you use every day."],
    nl: ["Steeds meer pro-functies komen in goedkopere apparaten en plugins. Een thuisstudio klinkt nu als een professionele ruimte van tien jaar geleden.", "Slimme functies — automatisch mixen, stem-scheiding, correctie — versnellen het werk, maar de beslissingen komen nog altijd van het oor van de producer.", "Check voor je nieuwe gear koopt of het je echte probleem oplost: tijd, sound of workflow. De beste investering gebruik je elke dag."],
    ua: ["Дедалі більше професійних функцій з'являється в дешевших пристроях і плагінах. Домашня студія сьогодні звучить як професійна десять років тому.", "Розумні функції — автоміксинг, розділення доріжок, корекція — пришвидшують роботу, але ключові рішення досі ухвалює вухо продюсера.", "Перш ніж купувати нову техніку, перевір, чи вона вирішує твою справжню проблему: час, звук чи зручність. Найкраща інвестиція — та, якою користуєшся щодня."],
  },
  rights: {
    pl: ["Spory o prawa autorskie wyznaczają granice tego, co wolno robić z muzyką — także z pomocą AI. Wyroki i ugody stają się wzorem dla kolejnych umów.", "Licencje między wytwórniami a firmami technologicznymi mogą otworzyć legalną drogę do nowych narzędzi. Kluczowe pytanie: czy artyści dostaną z tego uczciwy udział?", "Dla twórców wniosek jest prosty: dokumentuj swoją pracę, znaj swoje prawa i czytaj regulaminy platform, na które wrzucasz muzykę."],
    en: ["Copyright fights set the limits of what can be done with music — including with AI. Rulings and settlements become templates for the next deals.", "Licences between labels and tech firms could open a legal path to new tools. The key question: will artists get a fair share?", "For creators the lesson is simple: document your work, know your rights and read the terms of every platform you upload to."],
    nl: ["Rechtszaken over auteursrecht bepalen wat er met muziek mag — ook met AI. Uitspraken en schikkingen worden het model voor volgende deals.", "Licenties tussen labels en techbedrijven kunnen een legale weg naar nieuwe tools openen. Hamvraag: krijgen artiesten een eerlijk deel?", "Voor makers is de les simpel: documenteer je werk, ken je rechten en lees de voorwaarden van elk platform waar je uploadt."],
    ua: ["Суперечки про авторське право визначають межі того, що можна робити з музикою — зокрема з AI. Рішення й мирові угоди стають зразком для нових домовленостей.", "Ліцензії між лейблами й техкомпаніями можуть відкрити легальний шлях до нових інструментів. Головне питання: чи отримають артисти справедливу частку?", "Для творців висновок простий: документуй роботу, знай свої права й читай правила кожної платформи, куди завантажуєш музику."],
  },
  live: {
    pl: ["W czasach streamingu koncerty stały się głównym źródłem dochodu wielu artystów — dlatego ceny biletów i organizacja tras budzą tyle emocji.", "Technologia zmienia też scenę: od sprzedaży biletów, przez nagłośnienie, po transmisje dla tych, którzy nie mogą być na miejscu.", "Najlepsze wydarzenia łączą muzykę z doświadczeniem, którego nie da się powtórzyć w słuchawkach. To przewaga, której żaden algorytm nie odbierze."],
    en: ["In the streaming era, live shows became the main income for many artists — which is why ticket prices and tours spark so much debate.", "Tech is changing the stage too: ticketing, sound systems, and streams for those who can't be there.", "The best events pair music with an experience you can't recreate in headphones. That's an edge no algorithm can take away."],
    nl: ["In het streamingtijdperk werden concerten de belangrijkste inkomstenbron van veel artiesten — daarom zorgen ticketprijzen en tours voor zoveel discussie.", "Ook techniek verandert het podium: ticketing, geluid en streams voor wie er niet bij kan zijn.", "De beste events combineren muziek met een beleving die je niet in je koptelefoon nadoet. Een voorsprong die geen algoritme afpakt."],
    ua: ["В епоху стрімінгу концерти стали головним доходом багатьох артистів — тому ціни на квитки й тури викликають стільки емоцій.", "Технології змінюють і сцену: продаж квитків, звук, трансляції для тих, хто не може бути на місці.", "Найкращі події поєднують музику з досвідом, який не повториш у навушниках. Це перевага, яку не відбере жоден алгоритм."],
  },
  creators: {
    pl: ["Krótkie wideo stało się nowym radiem: fragment utworu potrafi wypromować go szybciej niż jakakolwiek kampania.", "Bezpośredni kontakt z fanami daje twórcom niezależność — ale też wymaga regularności i pomysłu na siebie.", "Platformy zmieniają zasady zasięgów, więc warto budować społeczność w kilku miejscach naraz i nie uzależniać się od jednego algorytmu."],
    en: ["Short video is the new radio: a snippet can break a song faster than any campaign.", "Direct contact with fans gives creators independence — but it takes consistency and a clear identity.", "Platforms keep changing reach rules, so build your community in several places and don't depend on a single algorithm."],
    nl: ["Korte video is de nieuwe radio: een fragment kan een nummer sneller groot maken dan welke campagne ook.", "Direct contact met fans geeft makers onafhankelijkheid — maar vraagt om regelmaat en een duidelijke identiteit.", "Platforms veranderen hun bereikregels, dus bouw je community op meerdere plekken en leun niet op één algoritme."],
    ua: ["Короткі відео — нове радіо: фрагмент треку може розкрутити його швидше за будь-яку кампанію.", "Прямий контакт із фанатами дає творцям незалежність, але вимагає регулярності й чіткої ідентичності.", "Платформи змінюють правила охоплень, тож будуй спільноту в кількох місцях і не залежи від одного алгоритму."],
  },
  research: {
    pl: ["Badania nad muzyką rzadko trafiają na pierwsze strony, a to z nich biorą się przyszłe narzędzia: lepsze rekomendacje, czystsze brzmienie, generatory, które rozumieją harmonię i rytm.", "Prace doktorskie i artykuły naukowe pokazują kierunek na lata do przodu — co działa, czego jeszcze nie umiemy i gdzie kończy się marketing, a zaczyna nauka.", "Książki dają coś, czego nie da szybki news: kontekst. Historia, teoria i praktyka pomagają lepiej słuchać i świadomiej tworzyć."],
    en: ["Music research rarely makes the front page, yet it's where future tools come from: better recommendations, cleaner sound, generators that understand harmony and rhythm.", "PhD theses and papers point the direction for years ahead — what works, what we can't do yet, and where marketing ends and science begins.", "Books offer what a quick news item can't: context. History, theory and practice help you listen better and create more consciously."],
    nl: ["Muziekonderzoek haalt zelden de voorpagina, maar daar komen toekomstige tools vandaan: betere aanbevelingen, schonere sound, generators die harmonie en ritme begrijpen.", "Proefschriften en papers wijzen de richting voor jaren — wat werkt, wat we nog niet kunnen en waar marketing ophoudt en wetenschap begint.", "Boeken geven wat snel nieuws niet geeft: context. Geschiedenis, theorie en praktijk helpen je beter luisteren en bewuster maken."],
    ua: ["Дослідження музики рідко потрапляють на перші шпальти, але саме з них виростають майбутні інструменти: кращі рекомендації, чистіший звук, генератори, що розуміють гармонію й ритм.", "Дисертації та наукові статті показують напрям на роки вперед — що працює, чого ми ще не вміємо і де закінчується маркетинг та починається наука.", "Книжки дають те, чого не дасть швидка новина: контекст. Історія, теорія й практика допомагають краще слухати й свідоміше творити."],
  },
  ai_tech: {
    pl: ["Postęp w modelach AI szybko trafia do aplikacji, z których korzystamy na co dzień — także muzycznych: od rekomendacji po narzędzia do tworzenia.", "Im mocniejsze modele, tym ważniejsze pytania o prywatność, koszty energii i to, kto kontroluje technologię.", "Najciekawsze nie są same zapowiedzi, ale to, co da się z nimi zrobić już dziś. Dlatego sprawdzamy, co z tych nowości przyda się twórcom i słuchaczom."],
    en: ["Advances in AI models quickly reach the apps we use daily — music ones too, from recommendations to creation tools.", "The stronger the models, the bigger the questions about privacy, energy costs and who controls the technology.", "The interesting part isn't the announcement but what you can do with it today. That's what we look at for creators and listeners."],
    nl: ["Vooruitgang in AI-modellen bereikt snel de apps die we dagelijks gebruiken — ook muziekapps, van aanbevelingen tot creatietools.", "Hoe sterker de modellen, hoe groter de vragen over privacy, energiekosten en wie de technologie beheert.", "Interessant is niet de aankondiging, maar wat je er vandaag mee kunt. Daar kijken we naar voor makers en luisteraars."],
    ua: ["Прогрес AI-моделей швидко потрапляє в застосунки, якими ми користуємося щодня, — і в музичні: від рекомендацій до інструментів творення.", "Що потужніші моделі, то гостріші питання приватності, енерговитрат і того, хто контролює технологію.", "Найцікавіше — не анонси, а те, що можна зробити вже сьогодні. Саме на це ми дивимося з погляду творців і слухачів."],
  },
};

const YOU: Record<Theme, Record<Lang, string>> = {
  ai_music: { pl: "Chcesz sprawdzić, jak AI pracuje z dźwiękiem? W [Studiu GrouAI](/studio) zrobisz utwór z opisu, a mastering −14 LUFS przygotuje go pod Spotify. Posłuchaj też, co tworzą inni, w [radiu GrouAI](/radio-live).", en: "Want to hear AI at work? In [GrouAI Studio](/studio) you can make a track from a prompt, mastered to −14 LUFS for Spotify. And hear what others create on [GrouAI radio](/radio-live).", nl: "Wil je AI aan het werk horen? In [GrouAI Studio](/studio) maak je een nummer vanuit een prompt, gemasterd op −14 LUFS voor Spotify. En luister wat anderen maken op [GrouAI-radio](/radio-live).", ua: "Хочеш почути AI в роботі? У [Студії GrouAI](/studio) створиш трек з опису з мастерингом −14 LUFS для Spotify. А що творять інші — слухай на [радіо GrouAI](/radio-live)." },
  streaming: { pl: "Na GrouAI słuchasz muzyki niezależnych twórców bez wielkich wytwórni po drodze. Odkryj nowe utwory w [radiu GrouAI](/radio-live) albo dodaj własne i zobacz, kto ich słucha.", en: "On GrouAI you hear independent creators with no major label in between. Discover new tracks on [GrouAI radio](/radio-live) or upload your own and see who listens.", nl: "Op GrouAI hoor je onafhankelijke makers, zonder groot label ertussen. Ontdek nieuwe nummers op [GrouAI-radio](/radio-live) of upload je eigen werk.", ua: "На GrouAI ти слухаєш незалежних творців без великих лейблів посередині. Відкривай нові треки на [радіо GrouAI](/radio-live) або завантаж свої." },
  gear: { pl: "Nie musisz od razu kupować sprzętu: w [Studiu GrouAI](/studio) sprawdzisz pomysł, a gotowy utwór przejdzie mastering pod Spotify. A gadżety dla producentów znajdziesz w [GrouaDrop](/shop/gadzety).", en: "You don't need new gear to start: test an idea in [GrouAI Studio](/studio), with mastering for Spotify. Producer gadgets live in [GrouaDrop](/shop/gadzety).", nl: "Je hoeft niet meteen gear te kopen: test een idee in [GrouAI Studio](/studio), met mastering voor Spotify. Gadgets voor producers vind je in [GrouaDrop](/shop/gadzety).", ua: "Не обов'язково одразу купувати техніку: перевір ідею в [Студії GrouAI](/studio) з мастерингом для Spotify. Гаджети для продюсерів — у [GrouaDrop](/shop/gadzety)." },
  rights: { pl: "Publikujesz na GrouAI? Utwory ze Studia dostają metadane i znacznik „✓ GrouAI Studio”, a Ty zachowujesz kontrolę nad tym, co i gdzie wydajesz. Szczegóły w [dokumentach prawnych](/legal).", en: "Publishing on GrouAI? Studio tracks get metadata and the “✓ GrouAI Studio” badge, and you stay in control of what you release and where. Details in our [legal pages](/legal).", nl: "Publiceer je op GrouAI? Studio-nummers krijgen metadata en het label “✓ GrouAI Studio”, en jij houdt de controle. Details in onze [juridische pagina's](/legal).", ua: "Публікуєш на GrouAI? Треки зі Студії отримують метадані й позначку «✓ GrouAI Studio», а ти контролюєш, що й де випускаєш. Деталі — у [правових документах](/legal)." },
  live: { pl: "Nie możesz być na koncercie? Włącz [radio GrouAI na żywo](/radio-live) — gra całą dobę, a w weekendy wieczorami rządzą klubowe sety.", en: "Can't make the show? Tune in to [GrouAI live radio](/radio-live) — on air 24/7, with club sets on weekend nights.", nl: "Kun je niet naar het concert? Luister naar [GrouAI live radio](/radio-live) — 24/7 in de lucht, met clubsets op weekendavonden.", ua: "Не встигаєш на концерт? Вмикай [радіо GrouAI наживо](/radio-live) — грає цілодобово, а у вихідні вечорами — клубні сети." },
  creators: { pl: "Budujesz publiczność? Wrzuć utwór na GrouAI, udostępnij link `?play=` i pogadaj z fanami w czacie — powiadomienia zawołają Cię, gdy ktoś napisze.", en: "Building an audience? Upload a track to GrouAI, share its `?play=` link and talk to fans in the chat — notifications call you when someone writes.", nl: "Bouw je aan een publiek? Upload een nummer op GrouAI, deel de `?play=`-link en praat met fans in de chat.", ua: "Будуєш аудиторію? Завантаж трек на GrouAI, поділись посиланням `?play=` і спілкуйся з фанатами в чаті." },
  research: { pl: "Teoria to jedno, a ucho drugie — sprawdź, jak te pomysły brzmią w praktyce w [Studiu GrouAI](/studio), i podziel się wrażeniami w komentarzach.", en: "Theory is one thing, your ears another — hear how these ideas sound in practice in [GrouAI Studio](/studio).", nl: "Theorie is één ding, je oren iets anders — hoor hoe deze ideeën in de praktijk klinken in [GrouAI Studio](/studio).", ua: "Теорія — одне, вухо — інше: послухай, як ці ідеї звучать на практиці в [Студії GrouAI](/studio)." },
  ai_tech: { pl: "Ciekawi Cię, jak takie technologie brzmią w praktyce? Zajrzyj do [Studia GrouAI](/studio) albo włącz [radio](/radio-live), gdzie prowadzi je prezenterka AI Nova.", en: "Curious how this tech sounds in practice? Visit [GrouAI Studio](/studio) or tune in to the [radio](/radio-live), hosted by AI presenter Nova.", nl: "Benieuwd hoe deze tech in de praktijk klinkt? Kijk in [GrouAI Studio](/studio) of luister naar de [radio](/radio-live) met AI-presentator Nova.", ua: "Цікаво, як ці технології звучать на практиці? Зазирни в [Студію GrouAI](/studio) або ввімкни [радіо](/radio-live) з AI-ведучою Nova." },
};

// ── Redakcja ─────────────────────────────────────────────────────────────────
function clip(s: string, n: number) {
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  const dot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (dot > n * 0.55 ? cut.slice(0, dot + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…").trim();
}
const md = (s: string) => s.replace(/([\[\]*_`])/g, "\\$1");

const H_RESEARCH: Record<Lang, { what: string; also: string }> = {
  pl: { what: "Na tapecie", also: "Warto też przeczytać" }, en: { what: "In focus", also: "Also worth reading" },
  nl: { what: "Uitgelicht", also: "Ook het lezen waard" }, ua: { what: "У фокусі", also: "Варто також прочитати" },
};

function compose(lang: Lang, theme: Theme, items: Item[], seed: number) {
  const h = theme === "research" ? { ...H[lang], ...H_RESEARCH[lang] } : H[lang];
  const lead = items[0];
  const native = lead.lang === lang;
  const pick = <T,>(arr: T[], k: number) => arr[(seed + k) % arr.length];
  const title = theme === "research" ? `${KICKER[theme][lang]}: ${lead.title}` : native ? `${KICKER[theme][lang]}: ${lead.title}` : FALLBACK_TITLE[theme][lang];
  const intro = pick(INTRO[theme][lang], 0);
  const description = clip(native && lead.summary ? lead.summary : `${intro} ${lead.title}`, 190);
  const why = WHY[theme][lang];
  const w1 = pick(why, 1), w2 = pick(why, 2) === w1 ? pick(why, 3) : pick(why, 2);
  const lines: string[] = [];
  lines.push(intro, "");
  lines.push(`## ${h.what}`, "");
  lines.push(`**${md(lead.title)}**${lead.summary ? ` — ${md(clip(lead.summary, 320))}` : ""} ([${md(lead.source)}](${lead.url}))`, "");
  const rest = items.slice(1, 4);
  if (rest.length) {
    lines.push(`## ${h.also}`, "");
    for (const it of rest) lines.push(`- **${md(it.title)}**${it.summary ? ` — ${md(clip(it.summary, 200))}` : ""} ([${md(it.source)}](${it.url}))`);
    lines.push("");
  }
  lines.push(`## ${h.why}`, "", w1, "", w2, "");
  lines.push(`## ${h.you}`, "", YOU[theme][lang], "");
  lines.push(`## ${h.src}`, "");
  items.slice(0, 4).forEach((it, k) => lines.push(`${k + 1}. [${md(it.source)}: ${md(clip(it.title, 110))}](${it.url})`));
  lines.push("", `*${h.note}*`);
  return { title: clip(title, 140), description, content: lines.join("\n") };
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = env("PUSH_DB_URL")?.replace(/\/+$/, ""), key = env("PUSH_DB_KEY");
  if (!url || !key) throw new Error("db not configured");
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: env("PUSH_DB_SECRET") ?? "", ...args }), signal: AbortSignal.timeout(10000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${t.slice(0, 160)}`);
  return (t ? JSON.parse(t) : null) as T;
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const dry = u.searchParams.has("dry");
  const cron = /vercel-cron/i.test(req.headers.get("user-agent") || "");
  if (!dry && !cron && !u.searchParams.has("run")) return json({ ok: true, info: "GrouAI blog-auto: ?dry=1 (podgląd), ?run=1 (publikacja, max 2/dobę)" });

  // Historia: limit 2/dobę, bez powtórek tematu (2 dni) i linków (14 dni).
  let recent: { theme: string; source_urls: string[]; created_at: string }[] = [];
  try { recent = (await rpc<typeof recent>("blog_auto_recent", { p_days: 14 })) ?? []; } catch (e) { if (!dry) return json({ ok: false, error: String((e as Error).message) }, 502); }
  const today = recent.filter((r) => Date.now() - Date.parse(r.created_at) < 864e5);
  if (!dry && today.length >= 2) return json({ ok: true, skipped: "limit 2/dobę" });
  const usedUrls = new Set(recent.flatMap((r) => r.source_urls.map(norm)));
  const usedThemes = new Set(recent.filter((r) => Date.now() - Date.parse(r.created_at) < 2 * 864e5).map((r) => r.theme));

  const research = u.searchParams.get("kind") === "research";
  const all = research ? await fetchResearch() : (await Promise.all(LANGS.flatMap((l) => FEEDS[l].map((f) => fetchFeed(f.url, l, f.source))))).flat();
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const it of all) {
    const k = norm(it.url), kt = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k) || seen.has(kt) || usedUrls.has(k)) continue;
    seen.add(k); seen.add(kt);
    const c = research ? it : classify(it);
    if (c) items.push(c);
  }

  // Najlepszy temat: suma najlepszych wpisów + różnorodność źródeł i języków.
  const themes = (research ? (["research"] as Theme[]) : (Object.keys(THEME_KW) as Theme[]).filter((t) => t !== "research")).map((th) => {
    const list = items.filter((i) => i.theme === th).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = list.slice(0, 6);
    const score = top.reduce((a, i) => a + (i.score ?? 0), 0) + new Set(top.map((i) => i.source)).size * 1.5 + new Set(list.map((i) => i.lang)).size * 2;
    return { th, list, score };
  }).filter((t) => t.list.length >= 2 && !(t.th !== "research" && usedThemes.has(t.th))).sort((a, b) => b.score - a.score);

  const best = themes[0];
  if (!best) return json({ ok: true, skipped: "brak dobrego tematu", fetched: all.length, relevant: items.length });

  const seed = Math.floor(Date.now() / 864e5);
  const en = best.list.filter((i) => i.lang === "en");
  const versions = {} as Record<Lang, ReturnType<typeof compose>>;
  const sources = new Set<string>();
  for (const l of LANGS) {
    const own = best.list.filter((i) => i.lang === l);
    const set = own.length >= 2 ? own.slice(0, 4) : [...own, ...en.filter((e) => !own.includes(e))].slice(0, 4);
    const use = set.length ? set : best.list.slice(0, 4);
    use.forEach((i) => sources.add(i.url));
    versions[l] = compose(l, best.th, use, seed);
  }
  const date = new Date().toISOString().slice(0, 10);
  const slug = `${date}-${slugify(versions.en.title || versions.pl.title) || best.th}`;
  const row = {
    slug, category: CAT[best.th], theme: best.th,
    tags: ["auto", best.th, ...Array.from(new Set(best.list.slice(0, 4).map((i) => i.source))).slice(0, 4)],
    title: versions.pl.title, description: versions.pl.description, content: versions.pl.content,
    title_en: versions.en.title, description_en: versions.en.description, content_en: versions.en.content,
    title_nl: versions.nl.title, description_nl: versions.nl.description, content_nl: versions.nl.content,
    title_ua: versions.ua.title, description_ua: versions.ua.description, content_ua: versions.ua.content,
    cover_url: null, source_urls: [...sources],
  };
  const lang = (u.searchParams.get("lang") || "") as Lang;
  if (dry) return json({ ok: true, dry: true, theme: best.th, score: Math.round(best.score), fetched: all.length, relevant: items.length,
    themes: themes.map((t) => ({ th: t.th, n: t.list.length, score: Math.round(t.score) })), slug,
    ...(LANGS.includes(lang) ? { article: versions[lang] } : { titles: Object.fromEntries(LANGS.map((l) => [l, versions[l].title])) }) });
  try {
    const saved = await rpc<string>("blog_auto_insert", { p_row: row });
    return json({ ok: true, published: saved, theme: best.th });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 502);
  }
}
