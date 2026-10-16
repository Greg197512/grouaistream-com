# Naprawa utworów, przycisk Blog, bot radia weekendowego, blog z historii, studio

## 1. Utwory nie grają (diagnoza, potem naprawa)
Stan w bazie: 1508 utworów na R2, 46 na skasowanych linkach Suno, 35 na hubie, 3 bez pliku.
- Sprawdzić w przeglądarce kilkanaście utworów z panelu głównego i zapisać, które błędy padają (plik nie istnieje, zły format, blokada odtwarzacza).
- Naprawić przyczynę w odtwarzaczu lub w danych (np. poprawić złe adresy plików).
- Utwory bez działającego pliku ukryć z panelu głównego, radia i wyszukiwarki (nie kasować), żeby każdy widoczny utwór grał.
- Dodać do katalogu 4 nowe piosenki Suno (Algorytm Serca, Cichy Twórca, Granica Nieskończoności, Most…) — skopiować nagrania na stałe na R2.

## 2. Przycisk Blog
Przycisk Blog istnieje, ale nie jest nigdzie wstawiony. Przywrócić go na stronie głównej obok przycisków w górnej sekcji oraz w menu bocznym i dolnym na telefonie.

## 3. Bot radia weekendowego
- Od piątku 20:00 do niedzieli 23:59 (czas polski) radio przełącza się na tryb „Party / Dance": utwory dyskotekowe, EDM, dance.
- W poniedziałek wraca do zwykłego trybu.
- Bot co godzinę sprawdza, czy radio gra, i naprawia kolejkę, gdy jest pusta.
- Bez płatnego AI, z wyłącznikiem i dziennym limitem jak pozostałe boty.

## 4. Blog: nowe opowiadania z najnowszych historii
- Codziennie jeden wpis-opowiadanie inspirowany najnowszymi wiadomościami (istniejący darmowy czytnik newsów), pisany darmowym AI.
- Publikacja automatyczna, z okładką z istniejących grafik (bez płatnej generacji).

## 5. GrouAI Studio
- Przetestować pełną ścieżkę tworzenia piosenki zalogowanym kontem: wpisanie opisu, generowanie, odsłuch, zapis.
- Naprawić każdy znaleziony błąd; gotowe utwory zapisywać na R2, żeby nie wygasały.

## Szczegóły techniczne
- Weryfikacja odtwarzania: Playwright + test HEAD/zakresów na próbce URL-i; flaga ukrycia (np. kolumna `is_playable`) zamiast usuwania.
- Bot weekendowy: funkcja serwerowa + harmonogram (managed HTTP schedule), korzysta z `apply_radio_mood('party')` i `automation_allowed`.
- Blog: rozszerzenie istniejącego generatora wpisów o źródło z newsfeed; darmowy model OpenRouter.
- Zakres płatny: brak nowych płatnych generacji poza kopiowaniem 4 gotowych nagrań.
