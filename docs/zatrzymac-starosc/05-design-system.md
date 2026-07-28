# 05 — Design system

Cel wizualny: produkt, który wygląda jak Apple + WHOOP + Oura + Tesla.
Ciemny, minimalistyczny, futurystyczny, z akcentami złotym i turkusowym.

---

## Paleta

Zdefiniowana w `tailwind.config.ts` jako przestrzeń `longevity-*`, **celowo
poza zmiennymi CSS aplikacji głównej** (pomarańczowej). To osobny produkt
w tym samym repozytorium — zmiana motywu Grouaistream nie może zmienić
wyglądu modułu zdrowotnego.

| Token | Wartość | Zastosowanie |
| --- | --- | --- |
| `longevity-void` | `#04060A` | Tło strony |
| `longevity-bg` | `#070A0F` | Tło szuflady, arkuszy |
| `longevity-surface` | `#0C1118` | Powierzchnie nieprzezroczyste |
| `longevity-line` | `rgba(255,255,255,0.07)` | Krawędzie |
| `longevity-ink` | `#F4F7FA` | Tekst główny |
| `longevity-muted` | `#8894A6` | Tekst drugorzędny |
| `longevity-gold` | `#E3C27E` | Akcent główny — marka, poziomy, wiek biologiczny |
| `longevity-gold-soft` | `#F6DCA6` | Rozjaśnienie gradientu |
| `longevity-gold-deep` | `#B8974F` | Przyciemnienie gradientu |
| `longevity-teal` | `#2DD4BF` | Akcent drugi — regeneracja, kierunek korzystny |
| `longevity-teal-soft` | `#7FE7DA` | |
| `longevity-teal-deep` | `#0E7C6F` | |
| `longevity-good` | `#4ADE9B` | Stan pozytywny |
| `longevity-warn` | `#F0B45E` | Ostrzeżenie |
| `longevity-danger` | `#F2707A` | Stan krytyczny |

### Semantyka kolorów — reguła bez wyjątków

**Turkus = kierunek korzystny. Złoty = neutralny lub marka. Czerwony =
niekorzystny.**

Ta reguła obowiązuje wszędzie: na wykresach, w kafelkach, w paskach udziałów.
Kierunek ustala silnik (`TrendAnalysis.direction`), a nie komponent — dzięki
temu wykres tętna spoczynkowego, gdzie **spadek jest dobry**, koloruje się
poprawnie bez żadnego wyjątku w kodzie interfejsu.

Konsekwencja tej samej reguły: pierścień indeksu stresu pokazuje **spokój**
(100 − indeks), żeby rosnący wskaźnik zawsze oznaczał poprawę. Liczba w środku
pozostaje surowym indeksem, bo do niej odwołuje się AI Coach i dokumentacja.

---

## Typografia

| Rola | Font | Zastosowanie |
| --- | --- | --- |
| Nagłówki, liczby | **Space Grotesk** (`font-display`) | Tytuły, wyniki, wartości |
| Treść | **Inter** (`font-sans`) | Opisy, listy, formularze |
| Ikony | Material Icons Outlined | Cały interfejs |

Wszystkie fonty są self-hosted przez `@fontsource` — zero żądań blokujących
render do `fonts.googleapis.com`.

Liczby zawsze z `tabular-nums`. Bez tego wartość skacząca z 68 na 71 przesuwa
sąsiedni tekst — drobiazg, który psuje wrażenie dopracowania.

Nagłówki: `tracking-tight`. Etykiety sekcji: `uppercase tracking-[0.22em]`
w rozmiarze 11 px — to element, który najmocniej buduje „premium".

---

## Glassmorphism

```tsx
<GlassCard accent="gold" interactive>
```

Receptura:

```css
rounded-2xl
border border-longevity-line
bg-white/[0.03]
backdrop-blur-xl
shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,
        0_20px_50px_-30px_rgba(0,0,0,0.9)]
```

**Wewnętrzny jasny cień u góry** (`inset`) jest tym, co odróżnia szkło od
zwykłego półprzezroczystego prostokąta — imituje krawędź odbijającą światło.
Bez niego karta wygląda płasko przy każdym rozmyciu tła.

### Tło z aurorą

`AuroraBackground` — trzy plamy w kolorach akcentowych, `blur-[120px]`,
animowane 26-sekundową pętlą `aurora-drift` (wyłącznie `transform`).

Na wierzchu warstwa szumu (SVG `feTurbulence` jako data URI, `opacity: 0.15`,
`mix-blend-overlay`). Bez niej duże gradienty pasmują na tańszych panelach —
widoczne pierścienie zamiast płynnego przejścia.

---

## Animacje — kontrakt 60 FPS

**Zasada: wyłącznie `transform` i `opacity`.** Oba są obsługiwane przez
kompozytor GPU i nie wywołują przeliczenia układu strony.

| Nazwa | Czas | Zastosowanie |
| --- | --- | --- |
| `aurora-drift` | 26 s | Tło |
| `glow-pulse` | 4 s | Aktywny stan, wskaźnik pisania |
| `rise-in` | 0,5 s | Wejście treści (`cubic-bezier(0.16, 1, 0.3, 1)`) |
| `sheen` | 2,4 s | Przesunięcie połysku |

Krzywa `cubic-bezier(0.16, 1, 0.3, 1)` — szybki start, długie wyhamowanie.
To ta sama charakterystyka co w systemowych animacjach iOS.

### Pierścień wyniku

`ScoreRing` animuje **wyłącznie `stroke-dashoffset`** przez 1100 ms. Łuk jest
otwarty u dołu (270°, `sweep = 0.75`) — zostawia miejsce na podpis i ułatwia
odczyt wartości. Gradient jest funkcją wartości: <40 czerwony, 40–55
złoty-pomarańczowy, 55–75 złoty, ≥75 turkusowy.

### Animacja oddechu

Najbardziej wymagający element. Rozwiązanie:

```ts
const state = phaseAt(protocol, elapsedSeconds);   // faza z CZASU, nie z licznika klatek
const scale = scaleForPhase(state.phase.kind, state.phaseProgress);
```

Stan jest funkcją czasu, który upłynął od startu, a nie liczby wyrenderowanych
klatek. Zgubiona klatka albo przejście aplikacji w tło nie rozjeżdżają rytmu
ćwiczenia — po powrocie animacja jest dokładnie tam, gdzie powinna.

Skala okręgu: `0,55 → 1,0` na wdechu, odwrotnie na wydechu, utrzymanie przy
zatrzymaniach. Poświata skaluje się razem z okręgiem, ale z mnożnikiem 1,1
i `blur-3xl`.

---

## Komponenty

### Prymitywy (`primitives.tsx`)

| Komponent | Rola |
| --- | --- |
| `AuroraBackground` | Tło strony |
| `GlassCard` | Karta szklana, warianty `accent` i `interactive` |
| `SectionTitle` | Etykieta + tytuł + opis + akcja |
| `Pill` | Plakietka, 6 tonów |
| `ConfidenceBadge` | **Pewność danych — obowiązkowa przy każdym wyniku** |
| `ProgressBar` | Pasek postępu z gradientem |
| `StatRow` | Wiersz etykieta–wartość |
| `Disclaimer` | Zastrzeżenie medyczne |
| `EmptyState` | Pusty stan **zawsze z następnym krokiem** |
| `LongevityButton` | Przycisk: `primary` (złoty), `teal`, `ghost` |

### Wykresy (`TrendChart.tsx`)

- `TrendChart` — recharts, obszar + linia średniej kroczącej 7-dniowej.
- `Sparkline` — czysty SVG, bez zależności, do kafelków.

Przy >60 punktach linia surowa cieńsza i z `strokeOpacity: 0.35`, a średnia
krocząca grubsza — inaczej wykres roczny jest nieczytelną plątaniną.

### Powłoka (`LongevityShell.tsx`)

- **Desktop** (≥1024 px): stała szyna 264 px, 15 pozycji, wskaźnik XP na dole.
- **Telefon**: dolny pasek z 5 najczęstszymi ekranami + „Więcej" (szuflada).

Aktywna pozycja: złoty pasek 2 px po lewej + złota ikona + jaśniejsze tło.
Trzy sygnały zamiast jednego, bo w ciemnym motywie sam kolor tła bywa
niewidoczny przy niskiej jasności ekranu.

---

## Wzorce interakcji

### Zapis bez przycisku „Zapisz"

Dziennik, dieta i ustawienia zapisują się przy każdej zmianie suwaka. Nie ma
przycisku zatwierdzania i nie ma ryzyka utraty wpisu.

Uzasadnienie: dziennik zdrowotny jest porzucany, gdy wymaga więcej niż
kilkunastu sekund dziennie. Każde dodatkowe kliknięcie to procent użytkowników,
którzy przestaną go prowadzić.

Synchronizacja jest opóźniona o 2 sekundy (debounce), żeby ruch suwakiem nie
generował żądania na każdy piksel.

### Suwaki zamiast pól tekstowych

Klawiatura numeryczna na telefonie zajmuje pół ekranu i wymaga precyzji, której
przy szacowaniu nawodnienia nikt nie potrzebuje. Wyjątek: ocena 1–5, gdzie pięć
przycisków jest szybsze niż suwak.

### Pusty stan zawsze z działaniem

Nigdy samo „brak danych". Zawsze: czego brakuje, skąd to wziąć, co kliknąć.

> „Fazy snu raportują zegarki i pierścienie noszone w nocy (Garmin, Oura,
> Apple Watch, WHOOP, Fitbit). Podłącz urządzenie w zakładce Urządzenia albo
> wpisz długość snu ręcznie w Dzienniku."

### Zastrzeżenie na każdym ekranie z wynikiem

`<Disclaimer />` jest wymogiem, nie ozdobnikiem. Każdy ekran pokazujący
wskaźnik zdrowotny ma je na dole, z treścią dopasowaną do modułu (sen odsyła
do lekarza przy bezdechach, stres — do telefonu zaufania 116 123).

---

## Responsywność

| Zakres | Układ |
| --- | --- |
| < 640 px | Jedna kolumna, dolny pasek, kafelki 2× |
| 640–1024 px | Dwie kolumny, kafelki 3–4× |
| ≥ 1024 px | Szyna boczna, siatki 5-kolumnowe (2+3), kafelki 6× |
| ≥ 1400 px | `max-w-6xl`, wyśrodkowane |

Siatka `lg:grid-cols-5` z podziałem 2+3 to podstawowy układ ekranów
szczegółowych: po lewej pierścień z rozbiciem, po prawej metryki i rekomendacja.

Treści szerokie (tabele, kalendarz konsekwencji) mają własny kontener
`overflow-x-auto`. Strona nigdy nie przewija się w poziomie.

---

## Dostępność

- Kontrast: `longevity-ink` na `longevity-void` = 17,8:1 (AAA);
  `longevity-muted` = 6,1:1 (AA dla tekstu normalnego).
- Fokus: `ring-2 ring-longevity-gold/60` z offsetem — widoczny na ciemnym tle.
- Ikony dekoracyjne: `aria-hidden`; interaktywne: `aria-label`.
- Wykresy: obok każdego są wartości liczbowe — informacja nigdy nie jest
  przekazywana wyłącznie kolorem.
- Kalendarz konsekwencji: `title` z datą i wynikiem na każdym polu.
- Nawigacja klawiaturą: wszystkie elementy interaktywne to `<button>` lub
  `<a>`, nie `<div onClick>`.

---

## Czego unikamy

| Antywzorzec | Dlaczego |
| --- | --- |
| Spinner przy starcie ekranu | Dane są w pamięci lokalnej — nie ma na co czekać |
| Toast po każdym zapisie | Zapis jest ciągły; toast co ruch suwakiem to hałas |
| Karta „wkrótce" | Nie ma atrap. Każdy element albo działa, albo go nie ma |
| Czerwony jako domyślny alert | Czerwień zarezerwowana dla stanów faktycznie krytycznych |
| Emoji jako ikony | Renderują się różnie na każdym systemie |
| Animacja `width` / `top` | Wymuszają przeliczenie układu, gubią klatki |
| Wykres bez interpretacji | Sama linia nie mówi, czy 8% to szum, czy sygnał |
