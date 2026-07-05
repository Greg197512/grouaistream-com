## Cel
Zamienić pulsującą pomarańczową obwódkę na grafice w radiu na **powoli podróżujący neonowy przebłysk**, który okrąża całą ramkę (góra → prawo → dół → lewo) zamiast jednolicie pulsować.

## Modyfikacje

### 1. Nowa klasa CSS `.radio-neon-orbit`
W `src/index.css` (w sekcji `@layer utilities` lub na końcu pliku) dodać efekt „obrączki z obrotowym neonem”:
- Wrapper `position: relative; overflow: hidden; border-radius: 1rem;`
- Pseudoelement `::before` z `conic-gradient` od transparent → `#ff8a00` → `#ffb347` → transparent.
- Animacja rotacji `rotate` 4–6 s liniowo, nieskończona.
- Środkowy element (zdjęcie) lekko wcięty (`inset: 2px`) z `bg-black`, żeby widoczny był tylko obracający się pasek neonu (grubość ~2–3 px).
- Dodatkowy `box-shadow` w kolorze pomarańczowym dla efektu rozbłysku na krawędzi.

### 2. Zmiana DOM w `src/pages/RadioLive.tsx`
- Zdjęcie (`<img>`) opakować w nowy `<div className="radio-neon-orbit">`.
- Usunąć lub pozostawić klasę `.radio-neon-pulse` tylko na zewnętrznym karcie (wg potrzeby), ale na samym zdjęciu zastąpić ją orbitującą ramką.

### 3. Fallback / kompatybilność
- Użyć standardowego `::before` + `z-index`, bez zewnętrznych bibliotek.
- Efekt ma działać na Chromium/WebKit (zgodny z używanym preview).

## Rezultat
Grafika w oknie radia będzie miała wokół siebie delikatną, pomarańczową linię neonu, która powoli „biega" wokół krawędzi jak świetlny pierścień.