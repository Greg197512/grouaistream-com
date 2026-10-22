import { describe, it, expect } from "vitest";
import { isDocumentFile, UNSUPPORTED_DOC_EXT, documentBlock, MAX_DOC_CHARS } from "./chatDocument";

describe("rozpoznawanie dokumentów w czacie", () => {
  it("akceptuje teksty i arkusze", () => {
    for (const n of ["notatki.txt", "README.MD", "dane.csv", "x.json", "napisy.srt", "piosenka.lrc", "arkusz.xlsx", "stary.xls"]) {
      expect(isDocumentFile(n), n).toBe(true);
    }
  });
  it("PDF i DOCX są rozpoznawane jako nieobsługiwane (z jasnym komunikatem)", () => {
    for (const n of ["umowa.pdf", "list.docx", "stary.doc"]) {
      expect(isDocumentFile(n), n).toBe(false);
      expect(UNSUPPORTED_DOC_EXT.test(n), n).toBe(true);
    }
  });
  it("nie łapie obrazów ani audio", () => {
    expect(isDocumentFile("zdjecie.jpg")).toBe(false);
    expect(isDocumentFile("utwor.mp3")).toBe(false);
  });
});

describe("documentBlock", () => {
  it("opakowuje treść w czytelne znaczniki", () => {
    const b = documentBlock("notatki.txt", "treść");
    expect(b).toContain("--- Dokument: notatki.txt ---");
    expect(b).toContain("treść");
    expect(b).toContain("--- koniec dokumentu ---");
  });
  it("limit długości jest sensowny (nie przepełni kontekstu)", () => {
    expect(MAX_DOC_CHARS).toBeLessThanOrEqual(50_000);
  });
});
