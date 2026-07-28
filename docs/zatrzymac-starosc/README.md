# Zatrzymać Starość — Stop Aging AI

Moduł HealthTech w repozytorium Grouaistream. Aplikacja webowa i mobilna, która
pomaga **spowolnić biologiczne skutki starzenia** przez poprawę stylu życia,
regenerację układu nerwowego i analizę danych z urządzeń noszonych.

> **To nie jest aplikacja medyczna ani diagnostyczna.** Nie obiecuje zatrzymania
> starzenia, nie stawia diagnoz i nie zastępuje lekarza. Każdy wskaźnik jest
> szacunkiem stylu życia opartym na danych użytkownika.

---

## Czym to jest w praktyce

Użytkownik rano otwiera pulpit i w ciągu 15 sekund wie trzy rzeczy:

1. **Ile ma dziś zasobów** — Body Battery, regeneracja, sen, energia.
2. **Co z tym zrobić** — pięć misji dobranych do stanu, nie z uniwersalnej listy.
3. **Czy idzie w dobrą stronę** — wiek biologiczny i trendy w oknach 7/30/90/365 dni.

Wieczorem uzupełnia dziennik (suwaki, 20 sekund), robi sesję oddechową lub
medytację i widzi, jak to przełożyło się na Epigenetic Lifestyle Score.

---

## Dokumentacja

| Dokument | Zawartość |
| --- | --- |
| [01 — Architektura](./01-architektura.md) | Struktura katalogów, warstwy, przepływ danych, decyzje projektowe |
| [02 — Baza danych](./02-baza-danych.md) | Schemat, RLS, indeksy, polityka retencji |
| [03 — API](./03-api.md) | Funkcje brzegowe, kontrakty, kody błędów, webhooki dostawców |
| [04 — Silnik wskaźników](./04-silnik-wskaznikow.md) | Metodologia każdego wyniku, wagi, źródła norm, ograniczenia |
| [05 — Design system](./05-design-system.md) | Paleta, typografia, komponenty, animacje, dostępność |
| [06 — Integracje](./06-integracje.md) | Garmin i 20 marek zegarków, mapowanie metryk, scalanie źródeł |
| [07 — Bezpieczeństwo i RODO](./07-bezpieczenstwo-rodo.md) | Dane wrażliwe, szyfrowanie, zgody, prawa użytkownika, MDR |
| [08 — Monetyzacja](./08-monetyzacja.md) | Free / Premium / Family / Lifetime, granice planów |
| [09 — Roadmapa 24 miesiące](./09-roadmapa-24-miesiace.md) | Sześć kwartałów, kamienie milowe, metryki sukcesu |
| [10 — Backlog](./10-backlog.md) | Zadania w kolejności wykonania, z oszacowaniami |
| [11 — Grouaistream Audio](./11-grouaistream-audio.md) | Spersonalizowane sesje audio, silnik doboru, plan wdrożenia |

---

## Stan wdrożenia

### Gotowe i działające

- **Silnik wskaźników** (`src/lib/longevity/`) — 13 modułów, wszystkie funkcje
  czyste i deterministyczne, 51 testów jednostkowych.
- **15 ekranów** (`src/pages/longevity/`) — pulpit, sen, stres, układ nerwowy,
  oddech, medytacje, AI Coach, wiek biologiczny, dieta, aktywność, trendy,
  misje, dziennik, urządzenia, ustawienia.
- **Warstwa danych** — local-first z synchronizacją do Supabase; aplikacja
  działa w całości offline.
- **Dźwięk** — synteza Web Audio (deszcz, ocean, las, noc, drony, fale
  binauralne), bez plików do pobrania.
- **Funkcje brzegowe** — `stop-aging-coach` (warstwa językowa) i
  `stop-aging-sync` (normalizacja danych z urządzeń).
- **Baza** — migracja `20260728050000_zatrzymac_starosc.sql` z pełnym RLS.

### Wymaga kluczy i umów partnerskich

- Połączenia OAuth z Garmin, Oura, WHOOP, Fitbit, Polar (rejestracja aplikacji
  u dostawcy → patrz [06 — Integracje](./06-integracje.md)).
- Aplikacja mobilna dla Apple Health i Health Connect (kod natywny — Q2).
- Klucz modelu językowego w Supabase Secrets (`GEMINI_API_KEY`,
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — dowolny z obsługiwanych).

---

## Uruchomienie

```bash
npm install
npm run dev
# → http://localhost:8080/zatrzymac-starosc
```

Aplikacja startuje bez żadnej konfiguracji: bez zalogowania i bez urządzenia
działa na danych lokalnych, a przycisk „Zobacz demo" na pulpicie wypełnia ją
180 dniami danych poglądowych (deterministycznych, oznaczonych banerem).

Testy silnika:

```bash
npx vitest run src/test/longevity.test.ts
```

Migracja bazy:

```bash
supabase db push
supabase functions deploy stop-aging-coach stop-aging-sync
```

---

## Trasy

| Ścieżka | Ekran |
| --- | --- |
| `/zatrzymac-starosc` | Pulpit |
| `/zatrzymac-starosc/sen` | Sen |
| `/zatrzymac-starosc/stres` | Stres |
| `/zatrzymac-starosc/uklad-nerwowy` | Układ nerwowy |
| `/zatrzymac-starosc/oddech` | Ćwiczenia oddechowe |
| `/zatrzymac-starosc/medytacje` | Biblioteka sesji |
| `/zatrzymac-starosc/coach` | AI Coach |
| `/zatrzymac-starosc/wiek` | Wiek biologiczny |
| `/zatrzymac-starosc/dieta` | Dieta |
| `/zatrzymac-starosc/aktywnosc` | Aktywność |
| `/zatrzymac-starosc/trendy` | Wykresy i trendy |
| `/zatrzymac-starosc/misje` | Misje, XP, odznaki |
| `/zatrzymac-starosc/dziennik` | Dziennik dnia |
| `/zatrzymac-starosc/urzadzenia` | Integracje |
| `/zatrzymac-starosc/ustawienia` | Profil, język, prywatność |

`/stop-aging` przekierowuje na wersję polską (alias dla linków zewnętrznych).

---

## Trzy zasady, które rządzą tym produktem

1. **Żadna liczba bez wyjaśnienia.** Każdy wynik zwraca listę `drivers` —
   udział poszczególnych czynników. Użytkownik zawsze może sprawdzić, skąd
   wzięła się liczba. Brak czarnych skrzynek.

2. **Brak danych to nie zero.** Czynnik bez pomiaru wypada z modelu i obniża
   `confidence`, zamiast być liczonym jako zero. Użytkownik bez opaski nie
   dostaje sztucznie dobrego ani sztucznie złego wyniku.

3. **Model językowy nie wymyśla zaleceń.** Merytorykę tworzy deterministyczny
   silnik reguł pokryty testami; model językowy jedynie ubiera gotowe wnioski
   w rozmowę. Awaria modelu nie zmienia treści porady.
