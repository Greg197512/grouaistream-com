// Czytanie dokumentów wrzucanych do czatu asystenta. Model dostaje TREŚĆ pliku
// (nie link), więc może go streścić, poprawić, przetłumaczyć albo odpowiedzieć
// na pytania. PDF i DOCX nie są tu czytane (brak parsera w projekcie) — użytkownik
// dostaje wtedy jasną informację zamiast cichego pominięcia.

export const TEXT_DOC_EXT = /\.(txt|md|markdown|csv|tsv|json|srt|lrc|xml|html?|log|rtf)$/i;
export const SHEET_EXT = /\.(xlsx|xls)$/i;
export const UNSUPPORTED_DOC_EXT = /\.(pdf|docx?|pages|odt|epub)$/i;

export const isDocumentFile = (name: string) => TEXT_DOC_EXT.test(name) || SHEET_EXT.test(name);

export const MAX_DOC_CHARS = 40_000;

/** Zwraca treść dokumentu jako tekst (arkusze → CSV po arkuszach). Nie rzuca. */
export async function readDocumentText(file: File): Promise<string> {
  let text = "";
  try {
    if (SHEET_EXT.test(file.name)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      text = wb.SheetNames
        .map((n) => `### Arkusz: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
        .join("\n\n");
    } else {
      text = await file.text();
    }
  } catch {
    text = "";
  }
  if (text.length > MAX_DOC_CHARS) {
    text = text.slice(0, MAX_DOC_CHARS) + `\n\n[…ucięto — pokazano pierwsze ${MAX_DOC_CHARS} znaków]`;
  }
  return text.trim();
}

/** Blok tekstu dokładany do wiadomości dla modelu. */
export const documentBlock = (name: string, text: string) =>
  `\n\n--- Dokument: ${name} ---\n${text}\n--- koniec dokumentu ---`;
