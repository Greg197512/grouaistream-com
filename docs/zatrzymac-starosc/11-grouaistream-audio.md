# 11 — Grouaistream Audio: spersonalizowane sesje

Integracja modułu zdrowotnego z platformą muzyczną Grouaistream. Cel: sesje
audio do **relaksu, koncentracji i snu**, dobierane i generowane pod aktualny
stan fizjologiczny użytkownika — a nie wybierane z listy odtwarzania.

---

## Dlaczego to ma sens akurat tutaj

Obie części żyją w jednym repozytorium i mają to, czego drugiej brakuje:

| Grouaistream ma | Moduł zdrowotny ma |
| --- | --- |
| Katalog 20 tys.+ utworów | HRV, sen, stres, stan układu nerwowego |
| Silnik generatywny (`groua-music-engine`) | Model osobistej normy (cyfrowy bliźniak) |
| Infrastrukturę audio (R2, streaming, playery) | Kontekst: pora dnia, cel sesji, obciążenie |
| Analizę cech utworów (`analyze-track-features`) | Powód, dla którego użytkownik słucha |

Aplikacje medytacyjne mają bibliotekę, ale nie wiedzą nic o użytkowniku.
Aplikacje zdrowotne wiedzą wszystko, ale odsyłają do Spotify. Połączenie
obu daje coś, czego nie ma żaden z dwóch osobno: **sesję dobraną do tego,
co dzieje się w organizmie w tej chwili**.

---

## Stan obecny (kwartał 0)

Warstwa dźwiękowa działa **w całości lokalnie**, bez zależności od katalogu:

- **Szum różowy 1/f** (filtr Paula Kelleta, 7 biegunów) → deszcz, ocean, las.
  Szum biały brzmi ostro i męczy po kilku minutach; różowy ma rozkład energii
  bliższy dźwiękom naturalnym.
- **Drony harmoniczne** — detuneowane oscylatory przez filtr dolnoprzepustowy,
  z powolną modulacją głośności każdej warstwy (bez niej dron brzmi martwo).
- **Dudnienia binauralne** — dwa czyste tony różniące się o częstotliwość
  docelową: delta 2,5 Hz (sen), theta 6 Hz (głęboki relaks), alfa 10 Hz
  (koncentracja). Wymagają słuchawek — różnica powstaje między kanałami.
- **Zdarzenia losowe** — ćwierkanie ptaków (synteza FM z obwiednią) i cykanie
  owadów, rozrzucone w czasie, żeby tło nie było statyczne.
- **Ocean z falą 0,1 Hz** — jedna fala na 10 sekund, czyli rytm spokojnego
  oddechu. Słuchacz nieświadomie się do niego dopasowuje.

14 sesji ma pełne scenariusze (kroki z instrukcjami i czasem trwania).
Pole `grouaistreamTag` czeka na podłączenie warstwy premium.

**Dlaczego synteza, a nie pliki.** Godzina deszczu w dobrej jakości to
50–80 MB. Synteza zajmuje kilkanaście kilobajtów kodu, startuje natychmiast,
działa offline i nigdy nie słychać zapętlenia — a sesja może trwać dowolnie
długo.

---

## Docelowa architektura

```
┌──────────────────────────────────────────────────────────────┐
│  KONTEKST UŻYTKOWNIKA                                        │
│  stan układu nerwowego · HRV vs baza · Body Battery ·        │
│  pora dnia · cel sesji · historia skuteczności               │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  SILNIK DOBORU (nowy: lib/longevity/audioEngine.ts)          │
│  cel → parametry: BPM, tonacja, gęstość, fala, wygaszanie    │
└──────────┬─────────────────────────────┬─────────────────────┘
           ▼                             ▼
┌────────────────────────┐   ┌───────────────────────────────┐
│  WARSTWA LOKALNA       │   │  GROUAISTREAM                 │
│  soundscape.ts         │ + │  katalog + silnik generatywny │
│  (zawsze dostępna)     │   │  + lektor TTS (Premium)       │
└────────────────────────┘   └───────────────────────────────┘
           └──────────────┬──────────────┘
                          ▼
              ┌───────────────────────┐
              │  MIKSER + PROWADZENIE │
              │  tło + głos + oddech  │
              └───────────────────────┘
```

Warstwa lokalna **nigdy nie znika**. Grouaistream dokłada muzykę i lektora,
nie zastępuje podstawy — dzięki temu brak sieci degraduje jakość sesji,
a nie odbiera ją całkowicie.

---

## Silnik doboru — mapowanie stanu na parametry

| Stan / cel | BPM | Fala | Tło | Wygaszanie | Uzasadnienie |
| --- | --- | --- | --- | --- | --- |
| **Przeciążenie** → relaks | 50–60 | theta 6 Hz | dron ciepły + deszcz | 20 min | Obniżenie pobudzenia bez usypiania |
| **Walka** → wyciszenie | 55–65 | theta 6 Hz | ocean 0,1 Hz | 15 min | Rytm fal prowadzi oddech w dół |
| **Zamrożenie** → aktywacja | 70–85 | alfa 10 Hz | las, jaśniejsze pasmo | brak | Delikatny bodziec, nie sedacja |
| **Regeneracja** → koncentracja | 60–70 | alfa 10 Hz | dron ciepły, bez melodii | brak | Tło, które nie zabiera uwagi |
| Sen (pora nocna) | 45–55 | delta 2,5 Hz | dron głęboki + noc | 45 min | Pierwsza faza nocy = sen wolnofalowy |
| Trening → regeneracja | 60 | koherentna 5,5/min | ocean | 10 min | Oddech rezonansowy po wysiłku |

Dwie zasady stałe:

1. **Brak wokalu i brak melodii w sesjach koncentracyjnych.** Tekst i linia
   melodyczna angażują te same zasoby uwagi, których użytkownik potrzebuje
   na zadanie.
2. **Wygaszanie zawsze przy sesjach sennych.** Dźwięk kończący się nagle
   wybudza; 45-minutowa rampa w dół jest niezauważalna.

---

## Personalizacja przez sprzężenie zwrotne

Po sesji zapisujemy skuteczność i uczymy się preferencji:

```ts
interface SessionOutcome {
  sessionId: string;
  soundscape: SoundscapeId;
  nervousStateBefore: NervousSystemState;
  durationMin: number;
  /** Ocena 1–5 zaraz po sesji. */
  subjectiveRelief?: number;
  /** Jeśli sesja senna — czy dane pokazały krótsze zasypianie. */
  sleepLatencyDelta?: number;
  /** Jeśli urządzenie mierzy HRV ciągle — zmiana w trakcie sesji. */
  hrvDelta?: number;
}
```

Po 10 sesjach silnik wie, że u tej osoby deszcz działa lepiej niż ocean,
a fale theta lepiej niż alfa — i przesuwa dobór. To ta sama zasada, co przy
osobistej normie HRV: **średnia populacyjna jest punktem startu, nie celem**.

Miara obiektywna (opóźnienie zasypiania, zmiana HRV) ma pierwszeństwo przed
oceną subiektywną, bo użytkownik ocenia sesję, w trakcie której zasnął, jako
„nie pamiętam".

---

## Warstwa lektorska

14 sesji ma gotowe scenariusze — sekwencje kroków z tekstem i czasem trwania.
Dziś tekst jest wyświetlany. Docelowo czytany:

- **TTS w 8 językach** (PL, EN, DE, NL, ES, IT, UA, FR) — jeden głos na język,
  wybrany pod kątem tempa i barwy odpowiedniej dla treści wyciszających.
- **Tempo mowy dopasowane do sesji**: 0,85× dla sesji sennych, 1,0× dla
  koncentracyjnych.
- **Miks**: lektor −6 dB nad tłem, z automatycznym ściszeniem tła (ducking)
  na czas wypowiedzi.
- **Cache po stronie klienta** — wygenerowana ścieżka jest zapisywana, żeby
  ta sama sesja nie kosztowała drugi raz.

Alternatywa rozważana: nagrania studyjne z lektorem. Odrzucona na tym etapie —
14 sesji × 8 języków = 112 nagrań, przy każdej korekcie scenariusza trzeba
nagrywać ponownie. TTS pozwala iterować scenariusze bez kosztu produkcyjnego.
Nagrania studyjne wracają jako opcja dla najpopularniejszych sesji w kwartale 6.

---

## Prowadzenie oddechu w ścieżce

Najbardziej wartościowy element integracji: **tło dźwiękowe prowadzi rytm
oddechu**, więc użytkownik nie musi patrzeć na ekran.

- Wdech — narastanie amplitudy i otwarcie filtra.
- Wydech — opadanie, przymknięcie filtra.
- Zatrzymanie — utrzymanie poziomu.

Tempo jest brane wprost z protokołu oddechowego (`BREATHING_PROTOCOLS`),
więc sesja 4-7-8 brzmi inaczej niż koherentna 5,5/5,5. To pozwala ćwiczyć
z zamkniętymi oczami, w łóżku, bez telefonu w dłoni — czyli w sytuacji,
w której ćwiczenie oddechowe ma największy sens.

Implementacja: modulacja parametrów istniejących warstw `soundscape.ts`
sterowana z `phaseAt()`. Nie wymaga nowej infrastruktury audio.

---

## Sesje generowane pod użytkownika

Podłączenie do `groua-music-engine`: generowanie unikalnej ścieżki
z parametrów wyznaczonych przez silnik doboru.

**Wejście**: BPM, tonacja, gęstość faktury, instrumentarium, długość,
punkt wygaszania, fala binauralna.

**Wyjście**: utwór w R2, przypisany do użytkownika, dostępny offline (Premium).

Wartość: użytkownik dostaje sesję, której nikt inny nie ma, dopasowaną do
konkretnego dnia. Ograniczenie: koszt generowania — dlatego wyłącznie Premium
i z limitem (np. 3 nowe sesje tygodniowo, reszta z katalogu).

---

## Plan wdrożenia (kwartał 5)

| Etap | Zakres | Czas |
| --- | --- | --- |
| 1 | `audioEngine.ts` — mapowanie stanu na parametry | 3 d |
| 2 | Most do katalogu Grouaistream (wyszukiwanie po cechach) | 4 d |
| 3 | Mikser: tło lokalne + utwór + wygaszanie | 4 d |
| 4 | TTS dla 8 języków + cache | 5 d |
| 5 | Prowadzenie oddechu w ścieżce | 3 d |
| 6 | Zapis skuteczności i personalizacja | 3 d |
| 7 | Tryb offline (pobrane sesje, Premium) | 4 d |
| 8 | Generowanie pod użytkownika (`groua-music-engine`) | 5 d |

**Razem: ~31 dni roboczych.**

---

## Metryki

| Metryka | Cel |
| --- | --- |
| Użytkownicy Premium z ≥1 sesją tygodniowo | ≥ 50% |
| Średni czas sesji | ≥ 12 min |
| Ukończone sesje (do końca scenariusza) | ≥ 65% |
| Ocena skuteczności (1–5) | ≥ 4,0 |
| Spadek opóźnienia zasypiania po sesji sennej | mierzalny u ≥ 40% |
| Retencja Premium D90 z aktywnym audio | ≥ 60% |

Ostatni wiersz jest uzasadnieniem biznesowym całej integracji: sesje audio
to funkcja, do której użytkownik wraca codziennie — a codzienny powód
otwarcia aplikacji jest tym, co odróżnia produkt subskrypcyjny od gadżetu.

---

## Ograniczenia, które mówimy wprost

- **Fale binauralne wymagają słuchawek.** Bez nich efekt nie występuje —
  komunikat jest widoczny przy każdej sesji, która ich używa.
- **Dowody naukowe dla fal binauralnych są ograniczone.** Badania pokazują
  niewielki efekt na subiektywne odprężenie i koncentrację; nie ma podstaw,
  by obiecywać więcej. Opisy sesji mówią o „tle, które nie zabiera uwagi",
  nie o „zwiększeniu inteligencji".
- **Sesje audio nie leczą bezsenności ani zaburzeń lękowych.** To techniki
  relaksacyjne. Przy utrzymujących się objawach zastrzeżenie kieruje do
  specjalisty.
- **Oddech w tle nie zastępuje ekranu przy nauce protokołu.** Pierwsze sesje
  warto wykonać z animacją; prowadzenie dźwiękiem jest dla osób, które rytm
  już znają.
