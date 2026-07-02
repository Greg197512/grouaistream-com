#!/usr/bin/env node
/**
 * Post-build static prerender for SEO/LLM crawlers.
 *
 * Reads dist/index.html and, for each route below, writes
 * dist/<route>/index.html with:
 *   - route-specific <title> and <meta name="description">
 *   - self-referencing canonical + og:url + og:title + og:description
 *   - a <div id="__seo"> block with real human-readable content
 *     placed BEFORE <div id="root"> so bots see it without JS.
 *
 * React hydrates <div id="root"> normally; the __seo block sits
 * outside root and does not interfere with the SPA.
 *
 * Vercel/Cloudflare serve /radio/index.html for /radio when the
 * SPA rewrite (see vercel.json) is set to fall back to index.html
 * only if the exact file is missing. On Vercel, the rewrite in
 * vercel.json is `/((?!api/).*) -> /index.html` which is a
 * FALLBACK rewrite: real files under dist/ are served first.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "..", "dist");
const BASE = "https://grouaistream.com";

const ROUTES = [
  {
    path: "/",
    title: "GrouAI Stream – Uczciwy streaming AI bez botów",
    description:
      "Pierwsza platforma muzyczna AI z weryfikacją ludzkich odsłuchań. Zero fake streamów, mood detection, GrouaRadio 24/7. No bots, real vibes.",
    h1: "GrouAI Stream — muzyka, która patrzy Ci w oczy i wie, kim jesteś akurat teraz",
    body: `
      <p>GrouAI Stream to platforma muzyczna z prawdziwym, weryfikowanym streamingiem — bez botów, bez pompowanych statystyk, bez oszukiwania artystów. Rozpoznajemy Twój nastrój z głosu i kamery, tworzymy utwory na żądanie w 15 gatunkach, uruchamiamy radio 24/7 i pozwalamy artystom zarabiać na każdym uczciwym odsłuchaniu.</p>
      <h2>Co potrafi GrouAI Stream</h2>
      <ul>
        <li><strong>Mood detection</strong> — kamera i głos wyczuwają nastrój, muzyka dopasowuje się w czasie rzeczywistym.</li>
        <li><strong>GrouaRadio Live 24/7</strong> — radio z czatem, lajkami i głosowaniem słuchaczy.</li>
        <li><strong>AI Music Studio</strong> — generowanie 30-sekundowych utworów z Twoim tekstem w 15 gatunkach.</li>
        <li><strong>Voice commands</strong> — mów do playera po polsku, angielsku, niderlandzku, ukraińsku.</li>
        <li><strong>Party Mode</strong> — QR-kod, głosowanie gości, kamera na tłum, wykrywanie emocji publiczności.</li>
        <li><strong>Verified human streams</strong> — antybotowa weryfikacja odsłuchań, uczciwe payouty dla twórców.</li>
      </ul>
      <h2>Dlaczego GrouAI</h2>
      <p>Zamiast kolejnego playera z algorytmem, dostajesz empatycznego DJ-a, który zna Twój rytm dnia, kontekst nastroju i historię odsłuchów. Artyści zarabiają realnie — bez farm botów zjadających budżety.</p>
      <nav aria-label="Główne sekcje">
        <a href="/radio">GrouaRadio</a> ·
        <a href="/radio-live">Radio Live</a> ·
        <a href="/upload">Wgraj muzykę</a> ·
        <a href="/suno">AI Studio</a> ·
        <a href="/earn">Zarabiaj z nami</a> ·
        <a href="/movies">Filmy</a> ·
        <a href="/search">Szukaj</a> ·
        <a href="/library">Biblioteka</a> ·
        <a href="/blog">Blog</a> ·
        <a href="/legal">Regulamin</a>
      </nav>
    `,
  },
  {
    path: "/radio",
    title: "GrouaRadio — Live 24/7 AI Radio | GrouAI Stream",
    description:
      "GrouaRadio to całodobowe live radio GrouAI Stream: AI-curated setlisty w EDM, Rock, Pop, Hip-Hop, Trance, House. Czat na żywo, lajki, tylko zweryfikowane odsłuchy.",
    h1: "GrouaRadio — 24/7 live radio",
    body: `
      <p>GrouaRadio nadaje 24 godziny na dobę. Programowanie miksuje AI-curated setlisty z realnymi zgłoszeniami społeczności — bez botów, bez sztucznych streamów. Słuchaj przez wbudowany player albo w każdej aplikacji podcastowej.</p>
      <h2>Gatunki na antenie</h2>
      <p>EDM, House, Trance, Rock, Pop, Hip-Hop, R&amp;B, Disco, Punk, Lo-Fi, Jazz, Ambient, Classical i więcej. Playlista adaptuje się do pory dnia i nastroju słuchaczy.</p>
      <h2>Funkcje na żywo</h2>
      <ul>
        <li>Live chat i głosowanie na kolejny utwór</li>
        <li>Realne odsłuchy — każdy stream zliczany po weryfikacji człowieka</li>
        <li>Codzienne nowości i zajawki od artystów</li>
        <li>Mobile-friendly: działa na iOS, Androidzie i w przeglądarce desktop</li>
      </ul>
      <nav aria-label="Nawigacja radia">
        <a href="/">Home</a> · <a href="/radio-live">Radio Live</a> · <a href="/upload">Wgraj utwór</a> · <a href="/suno">AI Studio</a> · <a href="/earn">Zarabiaj</a>
      </nav>
    `,
  },
  {
    path: "/earn",
    title: "Zarabiaj z GrouAI Stream — payouty dla artystów bez botów",
    description:
      "Wgraj muzykę na GrouAI Stream i zarabiaj na każdym zweryfikowanym odsłuchaniu. Uczciwe payouty, program poleceń, weekend challenges, milestone bonusy.",
    h1: "Zarabiaj z GrouAI Stream",
    body: `
      <p>GrouAI Stream płaci artystom za realne, ludzkie odsłuchy — nie za wygenerowane przez farmy botów statystyki. Wgraj utwór, rozdaj link, i zbieraj wypłaty co tydzień.</p>
      <h2>Jak zarobić</h2>
      <ol>
        <li><strong>Wgraj utwór</strong> na <a href="/upload">/upload</a> — minimum 2 minuty, weryfikacja AI moderator.</li>
        <li><strong>Rozdaj link</strong> do swojego profilu i zachęć słuchaczy.</li>
        <li><strong>Bonusy tygodniowe</strong> — Beginner, Active, Pro — im więcej realnych odsłuchów, tym wyższa stawka.</li>
        <li><strong>Referral program</strong> — polecaj GrouAI Stream i zbieraj prowizję z odsłuchów zaproszonych artystów.</li>
        <li><strong>Weekend challenges</strong> — dodatkowe pule nagród co weekend.</li>
        <li><strong>Milestone bonusy</strong> — jednorazowe wypłaty za 1k, 10k, 100k odsłuchów.</li>
      </ol>
      <nav aria-label="Zarabianie">
        <a href="/upload">Wgraj muzykę</a> · <a href="/earnings">Moje zarobki</a> · <a href="/auth">Załóż konto</a> · <a href="/legal">Regulamin payoutów</a>
      </nav>
    `,
  },
  {
    path: "/movies",
    title: "Filmy i teledyski AI — GrouAI Stream",
    description:
      "Katalog filmów, teledysków i wizualizacji AI na GrouAI Stream. Oglądaj wideo synchronizowane z muzyką, twórz własne klipy, wspieraj twórców.",
    h1: "Filmy i teledyski na GrouAI Stream",
    body: `
      <p>Sekcja Movies to teledyski, wizualizacje muzyczne i krótkie formy AI generowane przez społeczność GrouAI Stream. Każdy odtworzony klip zlicza się jako zweryfikowany stream dla twórcy.</p>
      <h2>Co znajdziesz</h2>
      <ul>
        <li>Teledyski do utworów z platformy</li>
        <li>AI-visualisers reagujące na dźwięk</li>
        <li>Krótkie formy typu reels z muzyką artystów</li>
        <li>Live wideo z GrouaRadio i imprez Party Mode</li>
      </ul>
      <nav aria-label="Wideo">
        <a href="/">Home</a> · <a href="/radio">GrouaRadio</a> · <a href="/upload">Wgraj wideo</a> · <a href="/library">Biblioteka</a>
      </nav>
    `,
  },
  {
    path: "/legal",
    title: "Regulamin i polityka prywatności — GrouAI Stream",
    description:
      "Regulamin, polityka prywatności, warunki korzystania i zasady payoutów GrouAI Stream. RODO, prawa autorskie, weryfikacja streamów, kontakt.",
    h1: "Regulamin i polityka prywatności",
    body: `
      <p>Ta strona zawiera regulamin GrouAI Stream, politykę prywatności zgodną z RODO oraz zasady programu wypłat dla artystów. Korzystając z platformy akceptujesz poniższe warunki.</p>
      <h2>Skrót najważniejszych punktów</h2>
      <ul>
        <li><strong>Prawa autorskie</strong> — wgrywasz tylko utwory, do których masz prawa. Naruszenia są usuwane w 24h.</li>
        <li><strong>Weryfikacja streamów</strong> — każdy stream przechodzi antybotową weryfikację przed wypłatą.</li>
        <li><strong>Payouty</strong> — minimalny próg 10 EUR, wypłaty tygodniowe na konto lub Revolut.</li>
        <li><strong>RODO</strong> — masz prawo do dostępu, usunięcia i przeniesienia swoich danych.</li>
        <li><strong>Kontakt</strong> — legal@grouaistream.com</li>
      </ul>
      <nav aria-label="Pomoc">
        <a href="/">Home</a> · <a href="/auth">Konto</a> · <a href="/earn">Payouty</a>
      </nav>
    `,
  },
];

const template = readFileSync(resolve(DIST, "index.html"), "utf8");

const escape = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

let written = 0;
for (const route of ROUTES) {
  const url = `${BASE}${route.path === "/" ? "/" : route.path}`;
  let html = template;

  // Swap <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(route.title)}</title>`);

  // Swap meta description
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${escape(route.description)}">`
  );

  // Swap canonical
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${url}" />`
  );

  // Swap og:url / og:title / og:description
  html = html
    .replace(
      /<meta\s+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${url}" />`
    )
    .replace(
      /<meta\s+property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escape(route.title)}" />`
    )
    .replace(
      /<meta\s+property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escape(route.description)}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${escape(route.title)}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${escape(route.description)}" />`
    );

  // Inject SEO body block BEFORE #root. Hidden visually (React owns UX),
  // still fully parseable by crawlers and LLMs.
  const seoBlock = `
    <div id="__seo" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">
      <h1>${escape(route.h1)}</h1>
      ${route.body}
    </div>
  `;
  html = html.replace('<div id="root"></div>', `${seoBlock}\n    <div id="root"></div>`);

  const outDir =
    route.path === "/" ? DIST : resolve(DIST, route.path.replace(/^\//, ""));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "index.html"), html, "utf8");
  written++;
  console.log(`  ✓ prerendered ${route.path} -> ${outDir}/index.html`);
}

console.log(`\n[prerender] Wrote ${written} static SEO pages to dist/`);
