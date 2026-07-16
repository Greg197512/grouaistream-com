// GROUAI HUB — generator PDF dla deliverables Aurory.
// Renderuje markdown (nagłówki, listy, pogrubienia, akapity) do prawdziwego PDF.
// Nagłówek na KAŻDEJ stronie: logo grouaistream.com + niebieski znaczek "B2B" z poświatą.
// Wbudowane czcionki pdf-lib (Helvetica); polskie znaki transliterowane do ASCII w PDF
// (pełna treść PL jest w mailu HTML). Logo osadzone jako PNG (base64), bez zależności runtime.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

// Logo grouaistream.com (ikona 64px, PNG base64 — osadzone, nie pobierane w runtime).
const LOGO_PNG_B64 = "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";
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Marka
const ORANGE = rgb(1, 0.42, 0);
const INK = rgb(0.06, 0.06, 0.06);
const GREY = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.85, 0.85, 0.85);
const BLUE = rgb(0.16, 0.47, 1);       // znaczek B2B
const GLOW = rgb(0.30, 0.60, 1);       // poświata B2B
const WHITE = rgb(1, 1, 1);

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 54;
const BAND = 58;                        // wysokość pasa nagłówka na każdej stronie
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
  let logo: any = null;
  try { logo = await doc.embedPng(b64ToBytes(LOGO_PNG_B64)); } catch { logo = null; }

  doc.setTitle(ascii(opts.title));
  doc.setAuthor("GrouAI Stream");
  doc.setCreator("GrouAI Stream - Aurora (B2B)");

  // Nagłówek marki na każdej stronie: logo + wordmark + niebieski znaczek B2B z poświatą.
  const drawBrandHeader = (p: any) => {
    p.drawRectangle({ x: 0, y: A4.h - 4, width: A4.w, height: 4, color: ORANGE });
    const top = A4.h - 24;
    if (logo) p.drawImage(logo, { x: MARGIN, y: A4.h - 46, width: 30, height: 30 });
    const wx = MARGIN + (logo ? 40 : 0);
    const wm = 14;
    let x = wx;
    p.drawText("Grou", { x, y: top, size: wm, font: bold, color: INK }); x += bold.widthOfTextAtSize("Grou", wm);
    p.drawText("AI", { x, y: top, size: wm, font: bold, color: ORANGE }); x += bold.widthOfTextAtSize("AI", wm);
    p.drawText(" Stream", { x, y: top, size: wm, font: bold, color: INK });
    p.drawText("grouaistream.com", { x: wx, y: top - 14, size: 8.5, font: regular, color: GREY });
    // Znaczek B2B (niebieski z poświatą) — prawy górny róg
    const bw = 50, bh = 22, bx = A4.w - MARGIN - bw, by = A4.h - 44;
    p.drawRectangle({ x: bx - 6, y: by - 6, width: bw + 12, height: bh + 12, color: GLOW, opacity: 0.14 });
    p.drawRectangle({ x: bx - 3, y: by - 3, width: bw + 6, height: bh + 6, color: GLOW, opacity: 0.28 });
    p.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: BLUE });
    const bt = "B2B", bts = 13, btw = bold.widthOfTextAtSize(bt, bts);
    p.drawText(bt, { x: bx + (bw - btw) / 2, y: by + (bh - bts) / 2 + 1, size: bts, font: bold, color: WHITE });
    // cienka linia pod pasem
    p.drawLine({ start: { x: MARGIN, y: A4.h - BAND }, end: { x: A4.w - MARGIN, y: A4.h - BAND }, thickness: 1, color: ORANGE });
  };

  let page = doc.addPage([A4.w, A4.h]);
  let pageNo = 1;
  drawBrandHeader(page);
  let y = A4.h - BAND - 16;

  const drawFooter = (p: any, n: number) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN - 14 }, end: { x: A4.w - MARGIN, y: MARGIN - 14 }, thickness: 0.5, color: RULE });
    p.drawText("GrouAI Stream - B2B - grouaistream.com", { x: MARGIN, y: MARGIN - 26, size: 8, font: regular, color: GREY });
    const ptxt = `Strona ${n}`;
    p.drawText(ptxt, { x: A4.w - MARGIN - regular.widthOfTextAtSize(ptxt, 8), y: MARGIN - 26, size: 8, font: regular, color: GREY });
  };

  const newPage = () => {
    drawFooter(page, pageNo);
    page = doc.addPage([A4.w, A4.h]);
    pageNo += 1;
    drawBrandHeader(page);
    y = A4.h - BAND - 16;
  };

  const ensure = (needed: number) => { if (y - needed < MARGIN + 6) newPage(); };

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

  // Blok tytułu (tylko strona 1, pod pasem marki)
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
