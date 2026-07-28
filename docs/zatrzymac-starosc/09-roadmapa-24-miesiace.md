# 09 — Roadmapa 24 miesiące

Osiem kwartałów. Każdy ma jeden cel nadrzędny, mierzalne kryteria wyjścia
i jawne ryzyka. Kolejność wynika z zależności technicznych, nie z atrakcyjności
funkcji.

---

## Stan wyjściowy (kwartał 0 — zrealizowany)

- Silnik wskaźników: 13 modułów, funkcje czyste, 51 testów jednostkowych.
- 15 ekranów webowych, w pełni responsywnych.
- Warstwa danych local-first z synchronizacją Supabase.
- Synteza dźwięku w Web Audio (7 protokołów oddechowych, 14 sesji audio).
- Dwie funkcje brzegowe: `stop-aging-coach`, `stop-aging-sync`.
- Schemat bazy z RLS, migracja gotowa do wdrożenia.
- Dokumentacja: 11 dokumentów.

---

## Kwartał 1 — Garmin i pierwsi użytkownicy

**Cel: pierwszy użytkownik z prawdziwymi danymi z Garmina.**

| Zadanie | Efekt |
| --- | --- |
| Rejestracja w Garmin Health API, OAuth 1.0a | Połączenie konta |
| Webhook push + mapper produkcyjny | Dane w ~5 min od synchronizacji zegarka |
| Szyfrowanie tokenów AES-256-GCM | Bezpieczne przechowywanie |
| Wdrożenie migracji + funkcji brzegowych | Środowisko produkcyjne |
| Onboarding (6 kroków, < 90 sekund) | Profil i pierwsze połączenie |
| Powiadomienia web push z limitem 4/dobę | Raport poranny |
| Testy E2E kluczowych ścieżek | Stabilność |
| Zamknięta beta: 100 użytkowników Garmin | Walidacja |

**Kryteria wyjścia**: 100 aktywnych użytkowników; ≥70% z połączonym Garminem;
retencja D7 ≥ 50%; zero incydentów bezpieczeństwa.

**Ryzyko**: proces zatwierdzenia w Garmin Health API trwa 4–8 tygodni.
*Ograniczenie*: wniosek składany w tygodniu 1; do czasu zgody rozwój na
danych demonstracyjnych i imporcie plików FIT.

---

## Kwartał 2 — Aplikacja mobilna

**Cel: Apple Health i Health Connect — kilkanaście marek jednym połączeniem.**

| Zadanie | Efekt |
| --- | --- |
| React Native + współdzielony silnik z `lib/longevity` | Jedna logika, dwie platformy |
| HealthKit + background delivery | Dane z Apple Watch |
| Health Connect + WorkManager | Samsung, Xiaomi, Amazfit, Honor, Oppo, OnePlus… |
| Biometria (Face ID / Touch ID / odcisk) | Blokada aplikacji |
| 2FA (TOTP) | Bezpieczeństwo konta |
| Powiadomienia natywne | Wyższa dostarczalność niż web push |
| Widżety (iOS / Android) | Wynik dnia bez otwierania aplikacji |
| Publikacja w App Store i Google Play | Kanał pozyskania |

**Kryteria wyjścia**: obie aplikacje w sklepach; ≥40% instalacji z połączonym
źródłem danych; ocena ≥4,5; crash-free ≥99,5%.

**Ryzyko**: odrzucenie przez App Review z powodu deklaracji zdrowotnych.
*Ograniczenie*: audyt wszystkich tekstów pod kątem wytycznych 1.4.1 i 5.1.3
przed pierwszym zgłoszeniem; zastrzeżenia widoczne, nie ukryte w regulaminie.

---

## Kwartał 3 — Ekosystem i premiera publiczna

**Cel: pełny wachlarz integracji i wyjście z bety.**

| Zadanie | Efekt |
| --- | --- |
| Oura, WHOOP, Fitbit (OAuth + webhooki) | Trzy najczęstsze uzupełnienia Garmina |
| Polar, Withings, Strava | Dane treningowe i masa ciała |
| Paddle: Free / Premium / Family / Lifetime | Monetyzacja |
| Trial 14 dni bez karty | Konwersja |
| Raporty tygodniowe PDF | Wartość Premium |
| Wielojęzyczność: EN, DE, NL | Rynki DACH i Beneluks |
| Premiera publiczna + kampania SEO | Skala |

**Kryteria wyjścia**: 5 000 zarejestrowanych; 150 subskrypcji płatnych;
MRR ≥ 5 800 zł; retencja D30 ≥ 35%.

---

## Kwartał 4 — Cyfrowy bliźniak drugiej generacji

**Cel: prognozy oparte na modelu uczonym, nie tylko na regułach.**

| Zadanie | Efekt |
| --- | --- |
| Model szeregów czasowych na danych zagregowanych | Prognoza HRV i snu na 3 dni |
| Personalizacja wag wskaźników | Model uczy się, co u tej osoby przewiduje samopoczucie |
| Wykrywanie anomalii (odchylenia od wzorca osobniczego) | Wczesne sygnały przeciążenia |
| Wyjaśnialność prognoz (udziały cech) | Zgodność z zasadą „żadnej liczby bez wyjaśnienia" |
| Testy A/B skuteczności rekomendacji | Dowód wartości |
| Wielojęzyczność: ES, IT, UA, FR | Pełne osiem języków |

**Kryteria wyjścia**: MAE prognozy HRV < 8%; 25 000 zarejestrowanych;
1 250 subskrypcji; ARR ≥ 585 tys. zł.

**Ryzyko**: model uczony traci wyjaśnialność, co uderza w podstawową zasadę
produktu. *Ograniczenie*: prognozy z modelu zawsze obok reguł, nigdy zamiast;
brak wyjaśnienia = brak publikacji funkcji.

---

## Kwartał 5 — Grouaistream Audio

**Cel: spersonalizowane sesje audio generowane pod stan użytkownika.**

Szczegóły: [11 — Grouaistream Audio](./11-grouaistream-audio.md).

| Zadanie | Efekt |
| --- | --- |
| Most do silnika muzycznego Grouaistream | Wspólny katalog |
| Generowanie sesji pod stan układu nerwowego | Audio dopasowane do dnia |
| Warstwa lektorska (TTS, 8 języków) | Medytacje prowadzone głosem |
| Dynamiczne tempo oddechu w ścieżce | Prowadzenie bez patrzenia na ekran |
| Sesje senne z wygaszaniem | Zasypianie |
| Tryb offline dla Premium | Pobrane sesje |

**Kryteria wyjścia**: ≥50% użytkowników Premium korzysta z sesji tygodniowo;
średni czas sesji ≥ 12 min; retencja Premium D90 ≥ 60%.

---

## Kwartał 6 — Społeczność i wyzwania

**Cel: retencja przez zobowiązanie społeczne.**

| Zadanie | Efekt |
| --- | --- |
| Ranking znajomych (opt-in, wyłącznie XP i serie) | Motywacja bez ujawniania danych zdrowotnych |
| Wyzwania grupowe (30 dni snu, 100 tys. kroków) | Zaangażowanie |
| Family: wspólne wyzwania | Wartość planu rodzinnego |
| Program poleceń | Pozyskanie |
| Publiczne profile osiągnięć (opt-in) | Zasięg organiczny |

**Kryteria wyjścia**: 70 000 zarejestrowanych; 4 550 subskrypcji;
MRR ≥ 177 tys. zł; ≥20% użytkowników w co najmniej jednym wyzwaniu.

**Ryzyko**: elementy społecznościowe w aplikacji zdrowotnej mogą zwiększać
presję i stres — sprzecznie z celem produktu. *Ograniczenie*: rankingi wyłącznie
opt-in, wyłącznie XP i serie (nigdy sen, waga, HRV), brak rankingów spadkowych,
brak porównań zdrowotnych.

---

## Kwartał 7 — B2B i profesjonaliści

**Cel: drugi strumień przychodu.**

| Zadanie | Efekt |
| --- | --- |
| Panel trenera / dietetyka (dostęp za zgodą klienta) | Narzędzie pracy |
| Pakiety wellness pracowniczego | Sprzedaż B2B |
| Statystyki zespołowe (wyłącznie agregaty, min. 10 osób) | Zgodność z RODO |
| API partnerskie | Integracje zewnętrzne |
| Eksport dla lekarza (PDF z zastrzeżeniami) | Rozmowa z profesjonalistą |
| Certyfikacja ISO 27001 | Warunek sprzedaży korporacyjnej |

**Kryteria wyjścia**: 10 klientów B2B; ≥15% przychodu z B2B; ISO 27001
w trakcie audytu.

**Ryzyko**: pracodawca widzący dane zdrowotne pracownika to poważne ryzyko
prawne. *Ograniczenie*: wyłącznie agregaty, minimalny rozmiar grupy 10 osób,
brak możliwości identyfikacji, umowa powierzenia z każdym klientem B2B.

---

## Kwartał 8 — Skala i dojrzałość

**Cel: produkt gotowy na rynek międzynarodowy.**

| Zadanie | Efekt |
| --- | --- |
| Suunto, COROS, Huawei | Domknięcie ekosystemu |
| Optymalizacja kosztów AI (cache, modele lokalne) | Marża |
| Zaawansowana analityka retencji | Sterowanie produktem |
| Rozważenie certyfikacji MDR klasy I | Otwarcie ścieżki medycznej |
| Ekspansja: kraje nordyckie, Czechy, Rumunia | Skala |
| Test penetracyjny + audyt bezpieczeństwa | Dojrzałość |

**Kryteria wyjścia**: 150 000 zarejestrowanych; 12 000 subskrypcji;
ARR ≥ 5,6 mln zł; retencja D90 ≥ 25%; NPS ≥ 45.

---

## Metryki prowadzące

| Metryka | Cel | Dlaczego ta |
| --- | --- | --- |
| **Retencja D30** | ≥ 40% | Mediana kategorii to 20–30%; poniżej 30% produkt nie ma modelu biznesowego |
| **Retencja D90** | ≥ 25% | Moment, w którym cyfrowy bliźniak zaczyna działać |
| Dni z danymi / użytkownik / tydzień | ≥ 5 | Poniżej tego wskaźniki tracą sens |
| Udział z połączonym urządzeniem | ≥ 60% | Determinuje `confidence` całego produktu |
| Ukończone misje / dzień | ≥ 2,5 | Wskaźnik realnej zmiany zachowania |
| Konwersja trial → płatny | ≥ 25% | |
| Rezygnacje miesięcznie | ≤ 5% | |
| NPS | ≥ 45 | |

**Retencja D30 jest metryką numer jeden.** Wszystkie pozostałe są jej pochodną:
aplikacja zdrowotna, która nie utrzymuje użytkownika przez miesiąc, nie zdąży
zbudować historii, bez której nie ma ani prognoz, ani powodu do płacenia.

---

## Ryzyka przekrojowe

| Ryzyko | Prawdopodobieństwo | Ograniczenie |
| --- | --- | --- |
| Odmowa lub opóźnienie dostępu do Garmin API | Średnie | Wniosek w tygodniu 1; import plików FIT jako ścieżka zapasowa |
| Odrzucenie w App Store (deklaracje zdrowotne) | Średnie | Audyt tekstów przed zgłoszeniem; zastrzeżenia widoczne |
| Zmiana kwalifikacji regulacyjnej (MDR) | Niskie | Konsekwentne unikanie zastosowań diagnostycznych; monitoring stanowisk MDCG |
| Koszt modelu językowego przy skali | Wysokie | Silnik reguł pokrywa 80% zapytań; cache; limity planu Free |
| Wyciek danych zdrowotnych | Niskie / krytyczne | RLS, szyfrowanie tokenów, minimalizacja kontekstu AI, test penetracyjny |
| Wypalenie użytkownika („kolejna aplikacja") | Wysokie | Limit 4 powiadomień, brak kar za gorszy dzień, dzień ochronny w serii |
| Konkurencja ze strony producenta zegarka | Średnie | Przewaga w agregacji wielu źródeł i w języku polskim |

---

## Podsumowanie zależności

```
K1 Garmin ────────────┐
                      ├──→ K3 Ekosystem ──→ K4 Bliźniak 2.0 ──→ K5 Audio
K2 Mobile ────────────┘                            │
                                                   ├──→ K6 Społeczność
                                                   └──→ K7 B2B ──→ K8 Skala
```

Kwartały 1 i 2 są równoległe i blokują wszystko dalej — bez danych
z urządzeń pozostałe funkcje nie mają na czym pracować.
