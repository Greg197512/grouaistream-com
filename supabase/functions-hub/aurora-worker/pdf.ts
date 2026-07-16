// GROUAI HUB — generator PDF dla deliverables Aurory.
// Renderuje markdown (nagłówki, listy, pogrubienia, akapity) do prawdziwego PDF.
// Używa wbudowanych czcionek pdf-lib (Helvetica) — zero zależności runtime od
// zewnętrznych czcionek. Polskie znaki są transliterowane do ASCII (WinAnsi-safe),
// dzięki czemu PDF zawsze się generuje. Pełna polska treść jedzie w mailu (HTML/UTF-8).
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

// Marka
const ORANGE = rgb(1, 0.42, 0);
const INK = rgb(0.06, 0.06, 0.06);
const GREY = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.85, 0.85, 0.85);

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 54;
const CONTENT_W = A4.w - MARGIN * 2;

// Transliteracja PL → ASCII + typowa interpunkcja, żeby Helvetica (WinAnsi) nie rzucała.
const MAP: Record<string, string> = {
  "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
  "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
  "–": "-", "—": "-", "‑": "-", "•": "-", "·": "-", "…": "...",
  "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'", "→": "->", "€": "EUR", "™": "(TM)", "®": "(R)", "©": "(C)",
};
function ascii(s: string): string {
  let out = "";
  for (const ch of s) {
    if (MAP[ch] !== undefined) { out += MAP[ch]; continue; }
    const code = ch.charCodeAt(0);
    out += code >= 0x20 && code <= 0x7e ? ch : (code === 0x09 ? "  " : "");
  }
  return out;
}

type Token =
  | { t: "h1" | "h2" | "h3" | "p" | "bullet" | "numbered"; text: string; num?: string }
  | { t: "rule" }
  | { t: "space" };

function parseMarkdown(md: string): Token[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const tokens: Token[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { tokens.push({ t: "space" }); continue; }
    if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) { tokens.push({ t: "rule" }); continue; }
    if (/^#{1}\s+/.test(trimmed)) { tokens.push({ t: "h1", text: trimmed.replace(/^#{1}\s+/, "") }); continue; }
    if (/^#{2}\s+/.test(trimmed)) { tokens.push({ t: "h2", text: trimmed.replace(/^#{2}\s+/, "") }); continue; }
    if (/^#{3,}\s+/.test(trimmed)) { tokens.push({ t: "h3", text: trimmed.replace(/^#{3,}\s+/, "") }); continue; }
    const num = trimmed.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (num) { tokens.push({ t: "numbered", num: num[1] + ".", text: num[2] }); continue; }
    if (/^[-*•]\s+/.test(trimmed)) { tokens.push({ t: "bullet", text: trimmed.replace(/^[-*•]\s+/, "") }); continue; }
    tokens.push({ t: "p", text: trimmed });
  }
  return tokens;
}

// Segmenty inline: pogrubienie **...**. Backticki/pojedyncze gwiazdki czyszczone.
type Seg = { text: string; bold: boolean };
function parseInline(text: string): Seg[] {
  const clean = text.replace(/`([^`]*)`/g, "$1");
  const segs: Seg[] = [];
  let bold = false;
  for (const p of clean.split(/(\*\*)/)) {
    if (p === "**") { bold = !bold; continue; }
    if (p) segs.push({ text: ascii(p.replace(/\*/g, "")), bold });
  }
  return segs.length ? segs : [{ text: ascii(clean.replace(/\*/g, "")), bold: false }];
}

export async function markdownToPdf(opts: {
  title: string;
  subtitle?: string;
  markdown: string;
  footerNote?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = (b: boolean) => (b ? bold : regular);

  doc.setTitle(ascii(opts.title));
  doc.setAuthor("GrouAI Stream");
  doc.setCreator("GrouAI Stream - Aurora");

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;
  let pageNo = 1;

  const drawFooter = (p: typeof page, n: number) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN - 14 }, end: { x: A4.w - MARGIN, y: MARGIN - 14 }, thickness: 0.5, color: RULE });
    p.drawText("GrouAI Stream · grouaistream.com".replace(/·/g, "-"), { x: MARGIN, y: MARGIN - 26, size: 8, font: regular, color: GREY });
    const ptxt = `Strona ${n}`;
    p.drawText(ptxt, { x: A4.w - MARGIN - regular.widthOfTextAtSize(ptxt, 8), y: MARGIN - 26, size: 8, font: regular, color: GREY });
  };

  const newPage = () => {
    drawFooter(page, pageNo);
    page = doc.addPage([A4.w, A4.h]);
    pageNo += 1;
    y = A4.h - MARGIN;
  };

  const ensure = (needed: number) => { if (y - needed < MARGIN + 6) newPage(); };

  // Zawijanie z pogrubieniem inline i opcjonalnym wiszącym prefiksem (punktor / numer).
  const drawWrapped = (segs: Seg[], size: number, lineGap: number, indent = 0, hangingPrefix?: { text: string; bold: boolean }) => {
    const maxW = CONTENT_W - indent;
    const words: Seg[] = [];
    for (const s of segs) {
      for (const w of s.text.split(/(\s+)/)) {
        if (w === "") continue;
        words.push(/^\s+$/.test(w) ? { text: " ", bold: s.bold } : { text: w, bold: s.bold });
      }
    }
    let lineWords: Seg[] = [];
    let lineW = 0;
    let firstLine = true;

    const flush = () => {
      ensure(size + lineGap);
      let x = MARGIN + indent;
      if (firstLine && hangingPrefix) {
        const pf = ascii(hangingPrefix.text);
        page.drawText(pf, { x: MARGIN + indent - font(hangingPrefix.bold).widthOfTextAtSize(pf + " ", size), y, size, font: font(hangingPrefix.bold), color: INK });
      }
      for (const w of lineWords) {
        if (w.text === " ") { x += font(w.bold).widthOfTextAtSize(" ", size); continue; }
        page.drawText(w.text, { x, y, size, font: font(w.bold), color: INK });
        x += font(w.bold).widthOfTextAtSize(w.text, size);
      }
      y -= size + lineGap;
      lineWords = [];
      lineW = 0;
      firstLine = false;
    };

    for (const w of words) {
      const wW = font(w.bold).widthOfTextAtSize(w.text, size);
      if (w.text === " ") { if (lineWords.length) { lineWords.push(w); lineW += wW; } continue; }
      if (lineW + wW > maxW && lineWords.length) flush();
      lineWords.push(w); lineW += wW;
    }
    if (lineWords.length) flush();
  };

  const heading = (text: string, size: number, gapBefore: number, gapAfter: number, color = INK) => {
    y -= gapBefore;
    ensure(size + gapAfter + 4);
    const words = ascii(text.replace(/\*/g, "")).split(/\s+/);
    let line = "";
    const drawLine = (ln: string) => {
      ensure(size + 3);
      page.drawText(ln, { x: MARGIN, y, size, font: bold, color });
      y -= size + 3;
    };
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (bold.widthOfTextAtSize(test, size) > CONTENT_W && line) { drawLine(line); line = w; }
      else line = test;
    }
    if (line) drawLine(line);
    y -= gapAfter;
  };

  // ── Baner / nagłówek dokumentu ──
  page.drawRectangle({ x: 0, y: A4.h - 4, width: A4.w, height: 4, color: ORANGE });
  page.drawText("GrouAI Stream", { x: MARGIN, y, size: 12, font: bold, color: INK });
  y -= 16;
  page.drawText(ascii("Autonomiczny dział biznesowy — Aurora"), { x: MARGIN, y, size: 9, font: regular, color: GREY });
  y -= 26;
  heading(opts.title, 20, 0, 4, INK);
  if (opts.subtitle) {
    ensure(14);
    page.drawText(ascii(opts.subtitle), { x: MARGIN, y, size: 10.5, font: regular, color: ORANGE });
    y -= 18;
  }
  page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: A4.w - MARGIN, y: y + 2 }, thickness: 1, color: ORANGE });
  y -= 14;

  for (const tok of parseMarkdown(opts.markdown)) {
    switch (tok.t) {
      case "space": y -= 5; break;
      case "rule":
        ensure(10);
        page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: A4.w - MARGIN, y: y + 2 }, thickness: 0.5, color: RULE });
        y -= 10; break;
      case "h1": heading(tok.text, 17, 10, 6, INK); break;
      case "h2": heading(tok.text, 13.5, 9, 5, ORANGE); break;
      case "h3": heading(tok.text, 11.5, 7, 4, INK); break;
      case "bullet": drawWrapped(parseInline(tok.text), 10.5, 4, 16, { text: "-", bold: false }); y -= 2; break;
      case "numbered": drawWrapped(parseInline(tok.text), 10.5, 4, 20, { text: tok.num || "-", bold: true }); y -= 2; break;
      case "p": drawWrapped(parseInline(tok.text), 10.5, 4, 0); y -= 4; break;
    }
  }

  drawFooter(page, pageNo);
  return await doc.save();
}
