// Wiedza o serwisie GrouAI Stream — wstrzykiwana do asystenta, żeby znał całą
// stronę (stare i nowe funkcje) i potrafił doradzić „gdzie co jest".
// NIE zawiera sekretów (np. kodu do katalogu) — to opis funkcji dla użytkownika.

export const SITE_KNOWLEDGE = `GrouAI Stream — serwis muzyczny z AI (grouaistream.com). Języki: polski, angielski, niderlandzki, ukraiński.

GŁÓWNE FUNKCJE:
• Strona główna (/) — polecane utwory, gatunki, nowości, radio, AI DJ, wejście do GROUA ERA.
• Wyszukiwarka (/search) — przeszukiwanie katalogu; pełny katalog odblokowuje kłódka-klucz w górnym pasku (dostęp tylko dla wybranych).
• Biblioteka (/library), Polubione (/liked), Playlisty (/playlist-manager), Moje utwory (/my-tracks).
• GrouAI Studio (/studio) — generowanie utworów AI: ręczny panel jak w Suno (tytuł, styl, tekst piosenki, długość, nastrój, tempo, styl wokalu, klon głosu) oraz pole opisu. Silniki: Suno/hub/lokalny. Darmowy limit dla nowych; pełny w Pro/Ultimate.
• Video Studio (/video) — tworzenie wideo i teledysków (zdjęcie postaci + tekst piosenki → teledysk).
• Radio 24/7 (/radio, /radio-live) — radio na żywo z czatem, lajkami; admin/DJ może przełączać nastrój playlisty i WEJŚĆ NA ANTENĘ (Live Mic) — głos DJ-a słychać u wszystkich słuchaczy (talkover na muzyce).
• Nocne opowiadania (/nocne) — czytane opowiadania z muzyką w tle.
• Binaural (/binaural), Movies (/movies), Local Player (/local-player), Import z YouTube (/import-youtube).
• Zarabianie: Zarobki twórców (/earnings), Zarabiaj z nami (/earn), boost utworów, napiwki, monetyzacja, wypłaty. Plany Pro/Ultimate w Ustawieniach.
• Upload własnych utworów (/upload) — po moderacji AI trafiają do katalogu z badge AI-Assisted.
• Mood detection — kamera analizuje emocje i dobiera muzykę; Historia nastroju (/mood-history), AI DJ (/ai-dj), Party Mode (kod QR dla gości, detekcja emocji tłumu, głosowanie).
• Blog (/blog) — 2 rzetelne, sprawdzone posty tygodniowo (wt i pt), z okładkami AI.
• Czat GrouAI — czat między użytkownikami z obecnością na żywo (kto jest online).

NOWOŚCI (najnowsze):
• GROUA ERA — Nostalgia Engine (/era): podróż przez epoki muzyczne (1970s, 1980s, 1990s, Y2K, 2000s, 2010s, NOW, FUTURE). W każdej epoce: opis, znani twórcy, kontekst kulturowy, świeże ciekawostki AI, grafika AI dobierana pod rok, warstwy „Brzmi jak ta epoka” (współcześni twórcy) i „AI ERA” (nowa muzyka AI w klimacie epoki). Wybór konkretnego roku, „Twoje Nostalgia DNA” z historii odsłuchów, „Podróż przez czas”, oraz „Stwórz ten rok w AI” (przenosi do Studia z gotowym presetem). Piosenka z datą w tytule brzmi jak z tamtej epoki.
• Neuronowy głos asystenta i lektora (w przeglądarce, naturalny) + asystent głosowy (mikrofon) rozmawiający na każdy temat.
• Darmowe generowanie okładek/grafik AI w całej stronie.
• Głos DJ-a na żywo słyszany przez wszystkich słuchaczy (talkover).

Jak doradzać: mów po ludzku, wskazuj konkretne miejsca (np. „wejdź w /era i wybierz rok”), zachęcaj do tworzenia i słuchania. Odpowiadaj w języku użytkownika. Nie podawaj żadnych kodów/kluczy dostępu.`;

export function siteKnowledge(): string {
  return SITE_KNOWLEDGE;
}
