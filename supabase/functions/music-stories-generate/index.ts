import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { callAI, AIMessage } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 80+ pionierów elektroniki / komputerów w muzyce (lata 70/80 → dziś)
const ARTISTS: Array<{ name: string; era: string; angle: string; tags: string[] }> = [
  // Pionierzy syntezatorów (lata 60/70)
  { name: "Wendy Carlos", era: "lata 60-70", angle: "Bach na Moogu — kobieta która pokazała światu że syntezator to instrument", tags: ["moog","classical","switched-on-bach"] },
  { name: "Kraftwerk", era: "lata 70-80", angle: "niemieccy ojcowie elektroniki — Autobahn, roboty, Mensch-Maschine", tags: ["kraftwerk","krautrock","electronic-pioneers"] },
  { name: "Tangerine Dream", era: "lata 70-80", angle: "berlińska szkoła ambient, soundtracki które zdefiniowały kino sci-fi", tags: ["tangerine-dream","berlin-school","ambient"] },
  { name: "Klaus Schulze", era: "lata 70-80", angle: "samotny architekt syntezatorowych katedr dźwięku", tags: ["klaus-schulze","ambient","modular"] },
  { name: "Jean-Michel Jarre", era: "lata 70-80", angle: "Oxygène nagrane w sypialni — Francuz który zagrał największe koncerty świata", tags: ["jarre","oxygene","french-electronic"] },
  { name: "Vangelis", era: "lata 70-90", angle: "Blade Runner i Chariots of Fire — grecki czarodziej Yamahy CS-80", tags: ["vangelis","blade-runner","cs-80"] },
  { name: "Giorgio Moroder", era: "lata 70-80", angle: "I Feel Love z Donną Summer — moment w którym powstała muzyka klubowa", tags: ["moroder","disco","donna-summer"] },
  { name: "Brian Eno", era: "lata 70-do dziś", angle: "wynalazca ambientu, generative music, Windows 95 startup sound", tags: ["eno","ambient","oblique-strategies"] },
  { name: "Yellow Magic Orchestra", era: "lata 70-80", angle: "japońska odpowiedź na Kraftwerk — Sakamoto, Hosono, Takahashi", tags: ["ymo","japan","sakamoto"] },
  { name: "Suzanne Ciani", era: "lata 70-80", angle: "kobieta która programowała Buchlę i robiła dźwięki dla Coca-Coli", tags: ["ciani","buchla","commercial-sound"] },
  { name: "Laurie Spiegel", era: "lata 70-80", angle: "programistka Bell Labs która komponowała algorytmami", tags: ["spiegel","algorithmic","bell-labs"] },

  // Synth-pop / new wave (lata 80)
  { name: "Depeche Mode", era: "lata 80-do dziś", angle: "z Basildon do stadionów — synth-pop który stał się religią", tags: ["depeche-mode","synth-pop","industrial"] },
  { name: "New Order", era: "lata 80-90", angle: "Blue Monday — najlepiej sprzedający się 12-cal w historii, nagrany na sequencerze który ciągle się psuł", tags: ["new-order","blue-monday","factory"] },
  { name: "Gary Numan", era: "lata 80", angle: "Cars i Are Friends Electric — chłopak z Wimbledonu który wymyślił dark synth", tags: ["numan","dark-synth","cars"] },
  { name: "Soft Cell", era: "lata 80", angle: "Tainted Love i seks-club Londynu — Marc Almond przed świtem", tags: ["soft-cell","tainted-love","new-romantic"] },
  { name: "Pet Shop Boys", era: "lata 80-do dziś", angle: "ironia, melancholia i synth — Tennant i Lowe od 1981 niezmiennie", tags: ["pet-shop-boys","west-end","synth-pop"] },
  { name: "Erasure", era: "lata 80-90", angle: "Vince Clarke i Andy Bell — synth-pop z tęczą", tags: ["erasure","synth-pop","vince-clarke"] },
  { name: "Yazoo", era: "lata 80", angle: "Vince Clarke + Alison Moyet — projekt który trwał krótko ale zostawił Only You", tags: ["yazoo","alison-moyet","clarke"] },
  { name: "OMD", era: "lata 80", angle: "Enola Gay i historia atomowa w synth-popie z Liverpool", tags: ["omd","enola-gay","liverpool"] },
  { name: "Ultravox", era: "lata 80", angle: "Vienna — utwór odrzucony przez wytwórnię, który stał się ikoną", tags: ["ultravox","vienna","midge-ure"] },
  { name: "Tears for Fears", era: "lata 80-90", angle: "Shout, Everybody Wants To Rule The World — terapia gestalt zamieniona w hity", tags: ["tears-for-fears","shout","gestalt"] },
  { name: "A-ha", era: "lata 80", angle: "Take On Me — animacja która zmieniła MTV i norweski synth-pop", tags: ["a-ha","take-on-me","norway"] },
  { name: "Eurythmics", era: "lata 80", angle: "Annie Lennox i Dave Stewart — Sweet Dreams nagrany w opuszczonej fabryce", tags: ["eurythmics","annie-lennox","sweet-dreams"] },

  // Industrial / EBM
  { name: "Throbbing Gristle", era: "lata 70-80", angle: "wynaleźli słowo 'industrial' — Genesis P-Orridge i sztuka dźwięku przemocowego", tags: ["throbbing-gristle","industrial","p-orridge"] },
  { name: "Cabaret Voltaire", era: "lata 70-80", angle: "Sheffield, taśmy i syntezatory — DIY industrial przed industrial", tags: ["cabaret-voltaire","sheffield","industrial"] },
  { name: "Front 242", era: "lata 80-90", angle: "belgijscy ojcowie EBM — Headhunter i militarystyczna estetyka klubu", tags: ["front-242","ebm","belgium"] },
  { name: "Nitzer Ebb", era: "lata 80-90", angle: "Join In The Chant — minimalizm który burzył parkiety", tags: ["nitzer-ebb","ebm","minimal"] },
  { name: "Skinny Puppy", era: "lata 80-do dziś", angle: "kanadyjski body horror dźwięku — Ogre i cEvin Key", tags: ["skinny-puppy","industrial","canada"] },
  { name: "Nine Inch Nails", era: "lata 90-do dziś", angle: "Trent Reznor sam w studio — Pretty Hate Machine i odkupienie przez algorytmy", tags: ["nin","reznor","industrial"] },

  // House / Techno / Acid
  { name: "Frankie Knuckles", era: "lata 80-90", angle: "Godfather of House — Warehouse Chicago i narodziny gatunku", tags: ["knuckles","house","chicago"] },
  { name: "Larry Heard", era: "lata 80-90", angle: "Mr. Fingers — Can You Feel It zmieniło house w sztukę", tags: ["mr-fingers","deep-house","chicago"] },
  { name: "Juan Atkins", era: "lata 80-90", angle: "Detroit techno od zera — Cybotron, Model 500 i wizja przyszłości", tags: ["atkins","detroit-techno","cybotron"] },
  { name: "Derrick May", era: "lata 80-90", angle: "Strings of Life — utwór który eksportował Detroit do Europy", tags: ["may","detroit","strings-of-life"] },
  { name: "Kevin Saunderson", era: "lata 80-90", angle: "Inner City i Big Fun — techno z duszą i wokalem", tags: ["saunderson","inner-city","detroit"] },
  { name: "Carl Craig", era: "lata 90-do dziś", angle: "drugie pokolenie Detroit — jazz + techno + Planet E", tags: ["craig","detroit","planet-e"] },
  { name: "Jeff Mills", era: "lata 90-do dziś", angle: "The Wizard — TR-909 jako instrument koncertowy", tags: ["mills","techno","909"] },
  { name: "Richie Hawtin", era: "lata 90-do dziś", angle: "Plastikman, minimal techno i estetyka pustki", tags: ["hawtin","plastikman","minimal"] },
  { name: "Aphex Twin", era: "lata 90-do dziś", angle: "Richard D. James w czołgu — geniusz IDM z Cornwall", tags: ["aphex-twin","idm","selected-ambient"] },
  { name: "Autechre", era: "lata 90-do dziś", angle: "Booth i Brown — algorytmy zamiast melodii, Warp Records w sercu", tags: ["autechre","idm","warp"] },
  { name: "Squarepusher", era: "lata 90-do dziś", angle: "bas, drum'n'bass i jazz — Tom Jenkinson jako one-man army", tags: ["squarepusher","drill-n-bass","warp"] },
  { name: "µ-Ziq", era: "lata 90-do dziś", angle: "Mike Paradinas i Planet Mu — IDM jak akwarela", tags: ["mu-ziq","planet-mu","idm"] },
  { name: "Boards of Canada", era: "lata 90-do dziś", angle: "bracia Sandison ze Szkocji — nostalgia dzieciństwa zakodowana w taśmach", tags: ["boc","ambient","scotland"] },

  // Trance / Goa / Big Beat
  { name: "The Prodigy", era: "lata 90-do dziś", angle: "Liam Howlett i Firestarter — punk rave który zniszczył MTV", tags: ["prodigy","big-beat","firestarter"] },
  { name: "The Chemical Brothers", era: "lata 90-do dziś", angle: "Ed Simons i Tom Rowlands — Block Rockin' Beats z Manchesteru", tags: ["chemical-brothers","big-beat","manchester"] },
  { name: "Fatboy Slim", era: "lata 90-2000", angle: "Norman Cook na plaży w Brighton — Praise You i Right Here Right Now", tags: ["fatboy-slim","big-beat","brighton"] },
  { name: "Underworld", era: "lata 90-do dziś", angle: "Born Slippy z Trainspotting — Karl Hyde tańczy ze swoim cieniem", tags: ["underworld","trainspotting","born-slippy"] },
  { name: "Orbital", era: "lata 90-do dziś", angle: "bracia Hartnoll z reflektorami na głowie — Glastonbury 1994", tags: ["orbital","glastonbury","hartnoll"] },
  { name: "Leftfield", era: "lata 90-2000", angle: "Phat Planet — bas tak głęboki że trzęsły się okna", tags: ["leftfield","progressive","phat-planet"] },
  { name: "Massive Attack", era: "lata 90-do dziś", angle: "trip-hop z Bristolu — Mezzanine i mrok jako kolor", tags: ["massive-attack","trip-hop","bristol"] },
  { name: "Portishead", era: "lata 90-do dziś", angle: "Beth Gibbons i Geoff Barrow — Dummy w opuszczonym kościele", tags: ["portishead","trip-hop","bristol"] },
  { name: "Tricky", era: "lata 90-do dziś", angle: "Maxinquaye — paranoja z Bristolu jako gatunek", tags: ["tricky","trip-hop","maxinquaye"] },

  // 2000+
  { name: "Daft Punk", era: "lata 90-2010", angle: "Thomas Bangalter, Guy-Manuel i hełmy — One More Time, Discovery, Random Access Memories", tags: ["daft-punk","french-house","discovery"] },
  { name: "Justice", era: "lata 2000-do dziś", angle: "krzyż, kompresor i Cross — francuska elektronika nowej generacji", tags: ["justice","french-electro","cross"] },
  { name: "M83", era: "lata 2000-do dziś", angle: "Anthony Gonzalez i Hurry Up We're Dreaming — synthwave przed synthwave", tags: ["m83","synthwave","hurry-up"] },
  { name: "Burial", era: "lata 2000-do dziś", angle: "Will Bevan w mieście duchów — South London Boroughs i mit anonimowości", tags: ["burial","dubstep","hyperdub"] },
  { name: "Four Tet", era: "lata 2000-do dziś", angle: "Kieran Hebden — folk-tronica i koncerty bez ekranu", tags: ["four-tet","folktronica","hebden"] },
  { name: "Caribou", era: "lata 2000-do dziś", angle: "Dan Snaith — matematyk doktorat → Swim → Suddenly", tags: ["caribou","dan-snaith","swim"] },
  { name: "Jamie xx", era: "lata 2010-do dziś", angle: "In Colour — londyński chłopak który pokochał garage i steel pany", tags: ["jamie-xx","in-colour","london"] },
  { name: "Bonobo", era: "lata 2000-do dziś", angle: "Simon Green — downtempo z duszą jazzową", tags: ["bonobo","downtempo","ninja-tune"] },
  { name: "Floating Points", era: "lata 2010-do dziś", angle: "Sam Shepherd — neuronaukowiec który gra z Pharoah Sandersem", tags: ["floating-points","pharoah-sanders","neuroscience"] },
  { name: "Nicolas Jaar", era: "lata 2010-do dziś", angle: "Space Is Only Noise — chilijsko-amerykański poeta minimalu", tags: ["jaar","minimal","space-is-only-noise"] },

  // Synthwave / Outrun
  { name: "Kavinsky", era: "lata 2000-do dziś", angle: "Drive i Nightcall — francuski mit Outrun", tags: ["kavinsky","synthwave","drive"] },
  { name: "Carpenter Brut", era: "lata 2010-do dziś", angle: "Franck Hueso — synthwave z horroru i krwi", tags: ["carpenter-brut","synthwave","horror"] },
  { name: "Perturbator", era: "lata 2010-do dziś", angle: "James Kent — dark synth, neon i cyberpunk", tags: ["perturbator","dark-synth","cyberpunk"] },
  { name: "Mitch Murder", era: "lata 2010-do dziś", angle: "szwedzki mistrz retro-synth — Far Cry 3 Blood Dragon", tags: ["mitch-murder","synthwave","blood-dragon"] },

  // Polskie
  { name: "Marek Biliński", era: "lata 80-do dziś", angle: "polski mistrz syntezatorów — E=mc², Ucieczka z tropiku", tags: ["bilinski","poland","emc2"] },
  { name: "Władysław Komendarek", era: "lata 80-do dziś", angle: "Exodus i polski space-rock — Mellotron jako serce muzyki", tags: ["komendarek","exodus","space-rock"] },
  { name: "Czesław Niemen", era: "lata 70-80", angle: "Mourner's Rhapsody — pierwszy polski album z Moogiem", tags: ["niemen","moog","mourners-rhapsody"] },
  { name: "Republika", era: "lata 80", angle: "Grzegorz Ciechowski i synthy — Biała Flaga, Nowe Sytuacje", tags: ["republika","ciechowski","new-wave"] },
  { name: "Aya RL", era: "lata 80", angle: "Skóra — polski cold wave z syntezatorami", tags: ["aya-rl","cold-wave","skora"] },
  { name: "Smolik", era: "lata 2000-do dziś", angle: "Andrzej Smolik — polski producent który łączy gatunki bez kompleksów", tags: ["smolik","poland","producer"] },

  // Kobiety w elektronice
  { name: "Delia Derbyshire", era: "lata 60-70", angle: "BBC Radiophonic Workshop — Doctor Who theme zrobiony nożyczkami", tags: ["derbyshire","bbc","doctor-who"] },
  { name: "Daphne Oram", era: "lata 50-70", angle: "Oramics — kobieta która rysowała dźwięki na taśmie", tags: ["oram","oramics","bbc"] },
  { name: "Pauline Oliveros", era: "lata 60-2010", angle: "Deep Listening — akordeon, elektronika i medytacja jako muzyka", tags: ["oliveros","deep-listening","accordion"] },
  { name: "Björk", era: "lata 90-do dziś", angle: "Homogenic, Vespertine, Biophilia — Islandia, biologia i Max/MSP", tags: ["bjork","iceland","biophilia"] },
  { name: "FKA twigs", era: "lata 2010-do dziś", angle: "Tahliah Barnett — R&B z futurystyczną produkcją Arca i innych", tags: ["fka-twigs","arca","experimental"] },
  { name: "Arca", era: "lata 2010-do dziś", angle: "Alejandra Ghersi z Wenezueli — KiCk i postgenderowa elektronika", tags: ["arca","kick","experimental"] },
  { name: "Holly Herndon", era: "lata 2010-do dziś", angle: "PROTO i AI Spawn — chórek wytrenowany na sieci neuronowej", tags: ["holly-herndon","ai","spawn"] },
  { name: "Yaeji", era: "lata 2010-do dziś", angle: "Kathy Yaeji Lee — koreańsko-amerykański deep house z poszeptem", tags: ["yaeji","house","korean"] },

  // Współcześni innowatorzy
  { name: "Skrillex", era: "lata 2010-do dziś", angle: "Sonny Moore — od emo do Bangarang i restartu dubstepu w USA", tags: ["skrillex","dubstep","brostep"] },
  { name: "Deadmau5", era: "lata 2000-do dziś", angle: "Joel Zimmerman i mysia głowa — progresywny house i live-streaming z studia", tags: ["deadmau5","progressive-house","mau5trap"] },
  { name: "Calvin Harris", era: "lata 2000-do dziś", angle: "Adam Wiles z Dumfries — od bedroom-popu do Coachelli", tags: ["calvin-harris","edm","dumfries"] },
  { name: "Disclosure", era: "lata 2010-do dziś", angle: "bracia Lawrence — Latch z Sam Smith i odrodzenie UK garage", tags: ["disclosure","uk-garage","latch"] },
  { name: "Flume", era: "lata 2010-do dziś", angle: "Harley Streten — australijski futurebass i Hi This Is Flume", tags: ["flume","future-bass","australia"] },
  { name: "Caroline Polachek", era: "lata 2010-do dziś", angle: "Pang i operatyczny art-pop z elektroniką", tags: ["polachek","art-pop","pang"] },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" }[c] || c))
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function injectAffiliateLinks(content: string, links: Array<{ display_text: string; url: string; keywords: string[] }>): string {
  let result = content;
  const used = new Set<string>();
  for (const link of links) {
    if (used.has(link.url)) continue;
    for (const kw of link.keywords) {
      if (!kw) continue;
      const pattern = new RegExp(`(?<!\\[)\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?!\\]|\\()`, "i");
      if (pattern.test(result)) {
        result = result.replace(pattern, `[${link.display_text}](${link.url})`);
        used.add(link.url);
        break;
      }
    }
  }
  return result;
}

async function huntArtistContext(FIRECRAWL_API_KEY: string | undefined, artist: string, angle: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${artist} synthesizer studio gear interview anecdote story`,
        limit: 5,
      }),
    });
    if (!res.ok) {
      console.error("Firecrawl search failed", res.status);
      return "";
    }
    const data = await res.json();
    const results = data?.data || data?.web?.results || [];
    if (!results.length) return "";
    return results.slice(0, 5).map((r: any) =>
      `- ${r.title || ""}: ${r.description || r.snippet || ""} (${r.url || ""})`
    ).join("\n");
  } catch (e) {
    console.error("Firecrawl exception", e);
    return "";
  }
}

async function generateCoverImage(artist: string, era: string, angle: string): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY missing — skipping cover");
    return null;
  }
  const prompt = `Premium editorial blog cover illustration for a music story about ${artist} (${era}). Theme: ${angle}. Style: cinematic, photoreal-meets-painterly, dramatic chiaroscuro lighting, deep blacks with neon amber and orange accents (GrouAI Stream brand). Subject: vintage synthesizers, modular cables, glowing studio gear, era-accurate equipment, atmospheric haze, no text, no logos, no faces of real people, no watermarks. 16:9 widescreen, ultra-detailed, museum-quality composition.`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("cover gen failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    const dataUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return dataUrl || null;
  } catch (e) {
    console.error("cover gen exception", e);
    return null;
  }
}


async function uploadCoverToStorage(supabase: any, dataUrl: string, slug: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const ext = mime.split("/")[1] || "png";
    const b64 = match[2];
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `covers/music-stories/${slug}.${ext}`;
    const { error } = await supabase.storage.from("blog-assets").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (error) {
      console.error("Storage upload failed", error);
      return null;
    }
    const { data } = supabase.storage.from("blog-assets").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("Upload exception", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  const triggeredBy = req.headers.get("x-trigger") || "cron";

  try {

    // Pick artist not used in last 60 posts of this category
    // (also looks at legacy 'music_stories' category for migration period)
    const { data: recent } = await supabaseAdmin
      .from("seo_blog_posts")
      .select("title, tags")
      .in("category", ["sound_chronicles", "music_stories"])
      .order("created_at", { ascending: false })
      .limit(60);

    const recentArtistNames = new Set<string>();
    for (const r of recent || []) {
      for (const a of ARTISTS) {
        if ((r.title || "").toLowerCase().includes(a.name.toLowerCase())) {
          recentArtistNames.add(a.name);
        }
      }
    }
    const available = ARTISTS.filter((a) => !recentArtistNames.has(a.name));
    const pick = (available.length > 0 ? available : ARTISTS)[Math.floor(Math.random() * (available.length || ARTISTS.length))];

    console.log(`Picked artist: ${pick.name} (${pick.era})`);

    // Hunt fresh anecdotes via Firecrawl
    const context = await huntArtistContext(FIRECRAWL_API_KEY, pick.name, pick.angle);
    const contextBlock = context
      ? `\n\nKONTEKST Z SIECI (parafrazuj, dodaj swój komentarz, NIE kopiuj 1:1):\n${context}`
      : "";

    // Generate article via AI
    const aiMessages: AIMessage[] = [
          {
            role: "system",
            content:
              "Jesteś dziennikarzem muzycznym premium dla GrouAI Stream — piszesz głębokie, emocjonalne historie o pionierach elektroniki i komputerów w muzyce (lata 70 → dziś). Twoje artykuły dają do myślenia, mają anegdoty, konkrety, daty, sprzęt, dramat. Styl: przepiękna polszczyzna, lekko literacka, z momentami zatrzymania, bez pustego marketingu. 1400-2000 słów. Markdown z H2/H3, blockquotes (cytaty samego artysty lub współpracowników), listy gdy ma to sens, **bold** dla najważniejszych momentów. Każda sekcja H2 ma 2-4 akapity. Wpleć szczegóły techniczne (modele syntezatorów, taśmy, sequencerów) ale tłumacz je przystępnie. KRYTYCZNE: Zwracaj WYŁĄCZNIE valid JSON object: {\"title\":\"...\",\"description\":\"...max 155 chars, mocny hook bez clickbaitu...\",\"content\":\"...markdown z \\n jako newline...\"}. WSZYSTKIE nowe linie w polu content MUSZĄ być escapowane jako \\n (backslash-n), NIGDY surowe newline. Cudzysłowy w tekście jako \\\".",
          },
          {
            role: "user",
            content: `Napisz historię muzyczną o: **${pick.name}** (era: ${pick.era}).\nKĄT: ${pick.angle}\n\nZacznij od mocnej sceny (konkretny moment w studiu, na koncercie, w życiu artysty). Pokaż jak technologia (syntezatory, komputery, sequencery, taśmy, samplery) zmieniła ich sposób tworzenia. Wpleć minimum 2 anegdoty, 1 cytat (autentyczny lub plausible), konkretne nazwy sprzętu. Zakończ refleksją co ich historia mówi o muzyce dziś. Naturalnie wpomnij raz GrouAI Stream (https://grouaistream.com) jako miejsce gdzie dziedzictwo elektroniki żyje dalej — bez nachalnej promocji.${contextBlock}`,
          },
        ];
    const rawText = await callAI(aiMessages, { model: "grok-3-mini", maxTokens: 8192 });

    const sanitizeForJson = (s: string) => s
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/\t/g, "\\t");

    let parsed: { title: string; description: string; content: string } | null = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      } catch {/* ignore */}
    }
    if (!parsed) {
      try {
        const m = cleaned.match(/\{[\s\S]*\}/);
        const candidate = m ? m[0] : cleaned;
        parsed = JSON.parse(sanitizeForJson(candidate));
      } catch {/* ignore */}
    }
    if (!parsed) {
      const titleMatch = cleaned.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const descMatch = cleaned.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const contentMatch = cleaned.match(/"content"\s*:\s*"([\s\S]*?)"\s*\}\s*$/);
      if (titleMatch && descMatch && contentMatch) {
        const unescape = (s: string) => s
          .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
          .replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        parsed = {
          title: unescape(titleMatch[1]),
          description: unescape(descMatch[1]),
          content: unescape(contentMatch[1]),
        };
      }
    }
    if (!parsed) throw new Error("AI returned invalid JSON");

    const slug = slugify(parsed.title) + "-" + Math.random().toString(36).slice(2, 7);

    // Inject affiliate links
    const { data: affiliates } = await supabaseAdmin
      .from("blog_affiliate_links")
      .select("display_text, url, keywords, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    const enrichedContent = injectAffiliateLinks(parsed.content, affiliates || []);

    // Generate cover
    let coverUrl: string | null = null;
    const dataUrl = await generateCoverImage(pick.name, pick.era);
    if (dataUrl) {
      coverUrl = await uploadCoverToStorage(supabaseAdmin, dataUrl, slug);
    }

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("seo_blog_posts")
      .insert({
        title: parsed.title,
        slug,
        description: parsed.description.slice(0, 160),
        content: enrichedContent,
        category: "sound_chronicles",
        tags: [...pick.tags, "kroniki-dzwieku", "music-history", "electronic-music", pick.era.replace(/\s+/g, "-")],
        cover_url: coverUrl,
        is_published: true,
        generated_by_ai: true,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    // Distribution hooks (best effort)
    try {
        const hookMessages: AIMessage[] = [
            {
              role: "system",
              content:
                "Jesteś social media copywriterem. Tworzysz hooki promujące historię muzyczną. Zwracasz TYLKO JSON: {\"x_hook\":\"...max 240 znaków, 1-2 emoji ok\",\"telegram_hook\":\"...max 400 znaków, emoji ok\",\"email_hook\":\"...1 zdanie hook, max 120 znaków\",\"email_subject\":\"...max 60 znaków\"}",
            },
            {
              role: "user",
              content: `Artykuł: "${parsed.title}"\nO: ${pick.name}\nLink: https://grouaistream.com/blog/${slug}`,
            },
          ];
        let hookData: any = null;
        try {
          const hText = await callAI(hookMessages, { model: "grok-3-mini", maxTokens: 512 });
          const hm = hText.match(/\{[\s\S]*\}/);
          if (hm) hookData = JSON.parse(hm[0]);
        } catch { /* ignore */ }
        if (hookData) {
          await supabaseAdmin.from("blog_post_hooks").insert({
            post_id: inserted.id,
            x_hook: hookData.x_hook?.slice(0, 280) || null,
            telegram_hook: hookData.telegram_hook?.slice(0, 500) || null,
            email_hook: hookData.email_hook?.slice(0, 160) || null,
            email_subject: hookData.email_subject?.slice(0, 80) || null,
          });
        }
      }
    } catch (e) {
      console.error("Hook gen failed", e);
    }

    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "music_story_generate",
      _level: "success",
      _message: `Nowa historia muzyczna: "${parsed.title}" (${pick.name})`,
      _metadata: { slug, post_id: inserted.id, artist: pick.name, era: pick.era, has_cover: !!coverUrl },
      _triggered_by: triggeredBy,
    });

    // Emit agent event
    await supabaseAdmin.from("agent_events").insert({
      source: "music-stories-generate",
      event_type: "blog.music_story_published",
      priority: 4,
      target_type: "blog_post",
      target_id: inserted.id,
      payload: {
        slug,
        title: parsed.title,
        artist: pick.name,
        era: pick.era,
      },
    });

    // IndexNow
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/indexnow-ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ urls: [`https://grouaistream.com/blog/${slug}`] }),
      });
    } catch {/* non-fatal */}

    return new Response(JSON.stringify({ success: true, post: inserted, artist: pick.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("music-stories-generate error:", msg);
    await supabaseAdmin.rpc("log_seo_activity", {
      _action_type: "music_story_generate",
      _level: "error",
      _message: `Błąd historii muzycznej: ${msg}`,
      _metadata: {},
      _triggered_by: triggeredBy,
    });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
