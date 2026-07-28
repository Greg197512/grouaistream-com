# 04 — Silnik wskaźników

Metodologia każdego wyniku, wagi, źródła norm i — przede wszystkim —
ograniczenia. Ten dokument jest kontraktem merytorycznym produktu: jeśli
kiedykolwiek zajdzie potrzeba obrony liczby przed użytkownikiem, dziennikarzem
albo regulatorem, odpowiedź jest tutaj.

---

## Trzy zasady wspólne dla wszystkich wyników

### 1. Brak danych to nie zero

Składnik bez pomiaru **wypada** z ważonej średniej zamiast być liczonym jako
zero. Użytkownik bez opaski nie dostaje sztucznie złego wyniku, a użytkownik
z samym telefonem nie dostaje sztucznie dobrego. Cena tej uczciwości to spadek
`confidence`, który jest widoczny w interfejsie przy każdej liczbie.

```ts
const { value, usedWeight, count } = weightedMean(components);
const confidence = confidenceFromCoverage(usedWeight, totalWeight);
// ≥75% wag → "high", ≥40% → "medium", poniżej → "low"
```

### 2. Każda liczba ma rozbicie

`ScoreResult.drivers` zawiera udział każdego składnika, a suma udziałów równa
się wynikowi. Nie ma wyniku, którego nie da się wyjaśnić.

### 3. Osobista norma przed normą populacyjną

HRV 42 ms to świetny dzień u jednej osoby i sygnał alarmowy u innej. Wszędzie,
gdzie to możliwe, silnik używa **z-score względem bazy użytkownika** z ostatnich
28 dni (mediana + odchylenie standardowe), a normy populacyjne stosuje tylko
przy zimnym starcie (mniej niż 7 dni danych).

Wyjątek: wiek biologiczny. Tam chodzi o pozycję względem populacji, więc HRV
i VO₂max są odnoszone do norm wiekowych.

---

## Sleep Score (0–100)

| Składnik | Waga | Normalizacja |
| --- | --- | --- |
| Długość snu | 30 | `plateau(240, cel−30, cel+60, 660)` |
| Regularność pór snu | 20 | `1 − normalize(circularStd(28 dni), 15, 120)` |
| Efektywność snu | 15 | `normalize(sen/czas w łóżku, 0.70, 0.95)` |
| Sen głęboki + REM | 12 | `normalize(udział, 0.25, 0.50)` |
| Pobudki | 8 | `1 − normalize(liczba, 1, 6)` |
| Sleep Score urządzenia | 10 | `wartość / 100` |
| Odczuwana jakość | 5 | `normalize(1–5)` |

**Dlaczego regularność ma wagę 20, tuż za długością.** Rozrzut pór zaśnięcia
koreluje z jakością regeneracji silniej niż pojedyncza długa noc. Osoba śpiąca
7 godzin codziennie o tej samej porze wypada lepiej niż osoba śpiąca 5 i 9
naprzemiennie — mimo identycznej średniej.

Regularność liczymy **statystyką kołową** (`circularStdMinutes`), bo 23:50
i 00:10 dzieli 20 minut, a nie 23 godziny 40 minut. Zwykła średnia
arytmetyczna dałaby tu południe jako „typową porę snu".

Minimum 4 noce w historii — poniżej tego składnik wypada.

---

## Indeks stresu (0–100, **wyżej = gorzej**)

Jedyny wskaźnik odwrócony. W interfejsie pierścień pokazuje spokój
(100 − indeks), żeby rosnący wskaźnik zawsze oznaczał poprawę.

| Składnik | Waga | Normalizacja |
| --- | --- | --- |
| HRV względem bazy | 30 | `clamp01(−z / 1.5)` — spadek o 1,5 SD = pełne obciążenie |
| Stres z urządzenia | 20 | `wartość / 100` |
| Tętno spoczynkowe | 15 | `clamp01(z / 2)` |
| Odczuwany stres | 15 | `normalize(1–5)` |
| Niedobór snu | 10 | `normalize(cel − sen, 0, 180 min)` |
| Obciążenie aktywnością | 5 | **krzywa U** |
| Liczba powiadomień | 5 | `normalize(40, 250)` |

**Krzywa U przy aktywności** — zarówno brak ruchu, jak i bardzo duże
obciążenie treningowe podnoszą stres fizjologiczny. Prosta zależność
„więcej ruchu = mniej stresu" byłaby fałszem dla osoby po interwałach.

**Powiadomienia jako proxy obciążenia uwagi.** To jedyny w silniku wskaźnik
behawioralny spoza fizjologii. Waga jest niska (5), bo związek jest pośredni,
ale sygnał jest realny: 250 powiadomień dziennie to inny dzień niż 40.

### Progi

| Indeks | Poziom |
| --- | --- |
| < 30 | Niski |
| 30–54 | Średni |
| 55–77 | Wysoki |
| ≥ 78 | Krytyczny |

---

## Regeneracja (0–100)

| Składnik | Waga |
| --- | --- |
| Gotowość z urządzenia (Training Readiness / Recovery / Readiness) | 25 |
| Jakość snu | 22 |
| Obciążenie stresem (odwrócone) | 18 |
| Body Battery | 15 |
| HRV względem bazy | 10 |
| Pozostały czas regeneracji | 5 |
| Obciążenie treningowe (Strain) | 3 |
| Bolesność mięśniowa | 2 |

Metryki producenta dostają najwyższą wagę, bo powstają z danych sekundowych,
do których aplikacja nie ma dostępu. Garmin próbkuje HRV co kilka sekund
przez całą noc — my dostajemy jedną wartość dobową.

---

## Energia, mózg, krążenie, metabolizm

**Energy Score** — sen (28), Body Battery (22), stres (18), odczuwana energia
(14), ruch (8), czas siedzenia (5), nawodnienie (5).

**Brain Recovery Score** — jakość snu (25), sen głęboki (15), REM (15), ekran
przed snem (12), medytacja i oddech (12), odczuwana koncentracja (10),
obciążenie uwagi (6), czas na zewnątrz (5). Składniki dobrane pod kątem tego,
co realnie wpływa na klirens glimfatyczny i konsolidację pamięci.

**Cardiovascular Score** — VO₂max względem normy wiekowej (30), tętno
spoczynkowe (18), aktywność umiarkowana i intensywna (16), HRV (14), status
palenia (12), ciśnienie (6), saturacja (4).

**Metabolic Score** — BMI (18), błonnik (13), cukry dodane (13), kroki (12),
białko (10), warzywa (10), czas siedzenia (8), żywność wysokoprzetworzona (6),
alkohol (5), obwód talii (3), pora ostatniego posiłku (2).

---

## Longevity Index

Kompozycja zbiorcza pokazywana na pulpicie:

| Składnik | Waga |
| --- | --- |
| Układ krążenia | 25 |
| Sen | 20 |
| Metabolizm | 18 |
| Stres i regulacja | 15 |
| Nawyki dnia (Epigenetic) | 10 |
| Regeneracja | 7 |
| Regeneracja mózgu | 5 |

Największa waga dla wydolności krążeniowej, bo ma najsilniejsze poparcie
w danych epidemiologicznych dotyczących długości życia w zdrowiu.

---

## Wiek biologiczny

> **Nie jest to zegar epigenetyczny.** Nie mierzymy metylacji DNA, telomerów
> ani żadnego biomarkera. Model przekłada nawyki i pomiary z urządzeń
> konsumenckich na skalę lat, korzystając z kierunków i rzędów wielkości
> znanych z badań populacyjnych nad stylem życia.

### Konstrukcja

```
wiek biologiczny = wiek metrykalny + Σ wkładów czynników
wkład = (0,5 − jakość) × 2 × maxLat
```

Jakość 1 → −maxLat (młodziej), jakość 0 → +maxLat, jakość 0,5 → 0 (przeciętnie).

| Czynnik | Maks. wpływ |
| --- | --- |
| Wydolność tlenowa (VO₂max) | ±4,0 roku |
| Jakość diety | ±2,4 |
| Długość snu | ±2,2 |
| BMI | ±2,2 |
| Poziom stresu | ±2,2 |
| HRV | ±1,8 |
| Kroki dziennie | ±1,6 |
| Regularność snu | ±1,4 |
| Aktywność intensywna | ±1,4 |
| Tętno spoczynkowe | ±1,2 |

### Używki — wpływ jednostronny

Niepalenie nie „odmładza". Palenie **dokłada**:

- palacz: +2,5 do +8 lat, skalowane liczbą papierosów,
- były palacz: +3 lata malejące liniowo do zera po ~15 latach od rzucenia,
- alkohol: do +2,5 roku powyżej progu 7 jednostek tygodniowo.

### Ograniczenia zapisane w kodzie

- **Okno 90 dni.** Krótsze okno dawałoby wynik skaczący o rok po jednej
  nieprzespanej nocy. Od tego jest wiek regeneracyjny.
- **Zakres −10…+15 lat.** Model stylu życia nie ma podstaw, by twierdzić, że
  ktoś jest o 25 lat młodszy. Ograniczenie jest twarde, w `clamp()`.
- **Braki są raportowane.** `missingInputs` wylicza, czego brakuje i co
  najbardziej poprawiłoby precyzję.

### Wiek regeneracyjny

Osobny wskaźnik, okno 7–14 dni:

```
jakość = 0,45 × regeneracja + 0,35 × sen + 0,20 × (1 − stres)
delta  = (0,5 − jakość) × 14 + 1        // −6 … +8 lat
```

To liczba, która spada po tygodniu złego snu i wraca po urlopie. Rozdzielenie
obu wskaźników rozwiązuje realny problem produktowy: użytkownik chce widzieć
zarówno wolnozmienny trend, jak i reakcję na to, co zrobił w tym tygodniu.

---

## Układ nerwowy — cztery stany na dwóch osiach

Model dwuosiowy zamiast jednej skali „stres wysoki/niski":

- **Pobudzenie** — tętno spoczynkowe powyżej bazy, Stress Score, przyspieszony
  oddech, odczuwane napięcie.
- **Rezerwa** — HRV względem bazy, gotowość z urządzenia, Body Battery.
- **Napęd behawioralny** (oś pomocnicza) — kroki, energia, nastrój.

| Stan | Warunek |
| --- | --- |
| **Regeneracja** | rezerwa ≥ 0,55 i pobudzenie < 0,45 |
| **Walka** | pobudzenie ≥ 0,55, rezerwa zachowana |
| **Przeciążenie** | pobudzenie ≥ 0,55 **i** (kumulacja wielodniowa **lub** rezerwa < 0,35) |
| **Zamrożenie** | rezerwa < 0,42 **i** napęd < 0,45 |

**Dlaczego trzecia oś.** Bez napędu behawioralnego „walka" i „zamrożenie" byłyby
nierozróżnialne — obie mają niską rezerwę. Różnica jest kliniczna i praktyczna:
w mobilizacji pomaga wydłużony wydech, w zamrożeniu odwrotnie — oddech
aktywujący i światło. Zalecenie oparte na złym rozpoznaniu pogłębiłoby problem.

**Kumulacja wielodniowa**: HRV poniżej 90% bazy przez ≥3 z 5 dni albo stres
≥60 przez ≥3 dni. To rozróżnia jednorazowy ciężki dzień od narastającego
przeciążenia.

---

## Epigenetic Lifestyle Score (100 pkt / dobę)

> Nazwa opisuje **kategorię nawyków** o udokumentowanym wpływie na ekspresję
> genów i procesy starzenia. To nie jest pomiar metylacji ani test laboratoryjny.

| Kategoria | Punkty | Cel pełnej punktacji |
| --- | --- | --- |
| Sen | 20 | 7–9 godzin |
| Warzywa | 15 | 5 porcji |
| Aktywność | 15 | 22 min intensywnie lub 8000 kroków |
| Medytacja | 10 | 10 minut |
| Spacer | 10 | 30 minut na zewnątrz |
| Nawodnienie | 10 | 2 litry |
| Bez alkoholu | 10 | 0 jednostek |
| Bez nikotyny | 5 | 0 papierosów |
| Wieczór bez ekranu | 5 | 0 minut w godzinie przed snem |

Suma sufitów = dokładnie 100 (pilnuje tego test jednostkowy).

**Punktacja częściowa, nie zero-jedynkowa.** 2,5 porcji warzyw daje 7,5 punktu,
nie zero. Dzień „prawie udany" nie może wyglądać jak zmarnowany — to podstawowa
zasada projektowa produktu, który ma obniżać stres, a nie go generować.

---

## Cyfrowy bliźniak

Warstwa statystyczna, nie osobny model językowy. Uczy się osobistej normy
(mediana + rozrzut) i na jej tle wykrywa odchylenia.

**Dlaczego mediana, a nie średnia** — jedna noc na lotnisku nie ma prawa
przesunąć normy, względem której oceniamy kolejne 27 dni.

### Prognozy

| Klucz | Horyzont | Podstawa |
| --- | --- | --- |
| `energyDip` | 1 dzień | Deficyt snu z 3 dni (65%) + trend HRV (35%) |
| `overtraining` | 7 dni | Obciążenie tygodniowe, Strain, średnia gotowość |
| `chronicStress` | 14 dni | Udział dni z podwyższonym stresem |
| `sleepDecline` | 7 dni | Kierunek trendu snu z 14 dni |
| `recoveryNeed` | 2 dni | Średni minimalny Body Battery z 7 dni |
| `bioAgeProjection` | 90 dni | Ekstrapolacja trendów snu i aktywności |

**Dojrzałość modelu** (`maturity = dni / 60`) jest pokazywana wprost. Poniżej
14 dni bliźniak jawnie sygnalizuje, że dopiero się uczy — nie udaje pewności,
której nie ma.

### Optymalna pora snu

Kołowa średnia z pór zaśnięcia w dniach, po których użytkownik miał **najlepszą
regenerację** (górne 30% wyników następnego dnia). Minimum 6 dni z parą
(pora snu, jakość następnego dnia); poniżej tego cofamy się do zwykłej bazy
chronotypu.

### Okno treningowe

`pobudka + 6h` do `pobudka + 9h` — u większości osób szczyt temperatury głębokiej
i siły. Liczone z **realnej pory wstawania użytkownika**, nie z ogólnej
rekomendacji „trenuj po południu".

---

## Progi istotności

Zmiana poniżej **3%** nie jest raportowana jako poprawa ani pogorszenie.
Dane dobowe z urządzeń konsumenckich mają rozrzut rzędu kilku procent —
nazywanie tego trendem byłoby wprowadzaniem w błąd.

Wykresy 90- i 365-dniowe używają średniej kroczącej 7-dniowej. Surowa linia
przy tej gęstości danych nie pokazuje niczego poza szumem.

---

## Czego silnik nie robi

- **Nie diagnozuje.** Nie ma reguły „HRV < X oznacza chorobę Y".
- **Nie wykrywa chorób.** Sygnały alarmowe (SpO₂ < 90%, tętno spoczynkowe > 90
  przez 3 dni, temperatura ≥ 38°C) prowadzą do jednego działania: zalecenia
  kontaktu z lekarzem. Nie do nazwy jednostki chorobowej.
- **Nie zaleca ani nie odradza leków i suplementów.**
- **Nie obiecuje zatrzymania starzenia.** Mówi o spowolnieniu skutków stylu
  życia i o konkretnych, mierzalnych zmianach.

---

## Pokrycie testami

`src/test/longevity.test.ts` — 51 testów. Kluczowe grupy:

- Funkcje numeryczne: `plateau`, statystyka kołowa przez północ.
- Sen: dobra vs zła noc, wpływ regularności, suma udziałów = wynik.
- Stres: **ocena względem bazy użytkownika, nie normy** (test z osobą o niskim
  HRV bazowym — 28 ms nie może dawać wysokiego stresu, jeśli to jej norma).
- Epigenetyka: sufit dokładnie 100, punktacja częściowa, brak przekroczeń.
- Wiek biologiczny: kierunek, zakres −10…+15, wykrycie palenia, spadek pewności.
- Układ nerwowy: rozpoznanie każdego z czterech stanów.
- Garmin: brak zalecenia intensywnego treningu przy Body Battery 32.
- Bezpieczeństwo: SpO₂ 86% podnosi wskazówkę bezpieczeństwa na priorytet 1.
- Determinizm generatora demo.
- Zakres 0–100 wszystkich wyników na danych demonstracyjnych.

```bash
npx vitest run src/test/longevity.test.ts
```
