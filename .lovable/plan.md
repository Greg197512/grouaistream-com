# Naprawa tworzenia muzyki w GrouAI Studio (sunoapi.org)

## Cel
Studio ma znowu tworzyć utwory przez sunoapi.org z nowym kluczem.

## Kroki
1. **Klucz** — podmienić wartość `SUNO_API_KEY` przez bezpieczny formularz (klucza wklejonego w czacie nie zapisuję ani nie powtarzam; najlepiej wygeneruj nowy na sunoapi.org, bo ten jest już ujawniony).
2. **Sprawdzenie klucza** — wywołać akcję `health` (nic nie generuje): ok / kredyty.
3. **Diagnoza na żywo** — jedno próbne generowanie z zalogowanego konta w Studio, odczyt logów funkcji i odpowiedzi sunoapi.org (code/msg), aby ustalić faktyczną przyczynę (np. brak kredytów, zły model, błąd sprawdzania statusu, odrzucenie przez minimalną długość 2:00).
4. **Poprawka** — naprawić tylko wskazane miejsce (funkcja `suno-generate` lub obsługa w Studio), wdrożyć ponownie i powtórzyć próbę aż utwór pojawi się w Studio.

## Uwaga
Jedno próbne generowanie zużyje kilka kredytów Suno.

## Szczegóły techniczne
- Funkcja: `supabase/functions/suno-generate` (akcje: health, generate, status; callback do samej siebie).
- Frontend: `src/pages/Suno.tsx`, `SunoGeneratePanel.tsx`, `src/lib/sunoClient.ts`.
- W ostatnim oknie logów brak wywołań — przyczyna niepotwierdzona, stąd krok 3.
