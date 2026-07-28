# 07 — Bezpieczeństwo i RODO

Dane zdrowotne to **szczególna kategoria danych osobowych** (RODO art. 9).
Ich przetwarzanie jest domyślnie zakazane i dopuszczalne wyłącznie na podstawie
jednej z przesłanek z ust. 2. Dla tej aplikacji jest to **wyraźna zgoda
użytkownika** (lit. a) — jedyna realna podstawa dla produktu konsumenckiego.

---

## Status regulacyjny

**Zatrzymać Starość nie jest wyrobem medycznym** w rozumieniu rozporządzenia
MDR (UE) 2017/745.

Kryterium z art. 2 pkt 1 MDR to *przewidziane zastosowanie* do diagnozowania,
zapobiegania, monitorowania, przewidywania, rokowania lub leczenia choroby.
Produkt konsekwentnie pozostaje poza tym zakresem:

| Robimy | Nie robimy |
| --- | --- |
| Szacujemy wskaźniki **stylu życia** | Nie diagnozujemy |
| Sugerujemy nawyki | Nie leczymy i nie zapobiegamy chorobom |
| Pokazujemy trendy własnych danych | Nie monitorujemy przebiegu choroby |
| Przy sygnałach alarmowych **kierujemy do lekarza** | Nie nazywamy jednostek chorobowych |

To rozgraniczenie jest utrwalone w kodzie, nie tylko w regulaminie:

- `MEDICAL_DISCLAIMER` dołączany do **każdego** raportu (`CoachReport`),
- `<Disclaimer />` na **każdym** ekranie z wynikiem, z treścią dopasowaną
  do modułu,
- prompt systemowy trenera zawiera pięć zasad bezwzględnych,
- funkcja brzegowa wykrywa objawy alarmowe **przed** wywołaniem modelu.

Nazwa „wiek biologiczny" jest wszędzie opatrzona wyjaśnieniem, że nie jest to
zegar epigenetyczny ani badanie laboratoryjne.

---

## Zgody — dwie osobne, nie jedna

```sql
health_consent_at  TIMESTAMPTZ,   -- przetwarzanie danych zdrowotnych (art. 9 ust. 2 lit. a)
ai_consent_at      TIMESTAMPTZ    -- wysyłanie kontekstu do modelu językowego
```

Użytkownik może korzystać z pełnej funkcjonalności **bez** zgody na AI — trener
działa wtedy wyłącznie na silniku reguł, w całości na urządzeniu. Zgoda
zgrupowana („akceptuję wszystko") byłaby wymuszeniem, a nie zgodą swobodną
w rozumieniu art. 4 pkt 11 i art. 7 ust. 4.

Wycofanie zgody musi być tak samo łatwe jak jej udzielenie (art. 7 ust. 3) —
w Ustawieniach jest to jeden przełącznik, nie formularz kontaktowy.

---

## Prawa użytkownika — realizowane jednym kliknięciem

| Prawo | Podstawa | Realizacja |
| --- | --- | --- |
| Dostęp | art. 15 | Wszystkie dane widoczne w interfejsie |
| **Przenoszenie** | art. 20 | Eksport JSON (`ExportBundle`, wersjonowany) |
| Sprostowanie | art. 16 | Edycja dowolnego dnia w Dzienniku |
| **Usunięcie** | art. 17 | Przycisk „Usuń wszystkie dane" + `ON DELETE CASCADE` |
| Ograniczenie | art. 18 | Wyłączenie synchronizacji → tryb wyłącznie lokalny |
| Sprzeciw | art. 21 | Wyłączenie AI Coacha i powiadomień |

### Usunięcie danych

Realizowane na dwóch poziomach:

1. **Baza** — `ON DELETE CASCADE` na wszystkich kluczach obcych do
   `auth.users`. Usunięcie konta kasuje komplet danych modułu w jednej
   transakcji. Bez zadania w kolejce, bez ryzyka pominięcia tabeli.
2. **Klient** — `wipeLocalData()` + `wipeRemoteData()` z ekranu Ustawień,
   z potwierdzeniem i przypomnieniem o możliwości wcześniejszego eksportu.

### Eksport

Format samodokumentujący i wczytywalny z powrotem (`importBundle`). Wersjonowany
— paczka o nieznanej wersji jest odrzucana, nie wczytywana częściowo.

---

## Szyfrowanie

| Warstwa | Mechanizm |
| --- | --- |
| Transport | TLS 1.3 (wymuszony przez Supabase, brak nasłuchu HTTP) |
| Spoczynek — baza | AES-256 po stronie usługi (Supabase / AWS) |
| Spoczynek — kopie | AES-256, retencja 30 dni, PITR |
| **Tokeny dostawców** | **AES-256-GCM w warstwie aplikacji**, klucz w Supabase Secrets |
| Pamięć lokalna | Szyfrowanie dyskowe systemu (FileVault / BitLocker / Android FBE) |

Tokeny OAuth są szyfrowane **dodatkowo**, w warstwie aplikacji, ponad
szyfrowaniem bazy. Powód: dostęp do bazy (backup, zrzut, pomyłka
administratora) nie może oznaczać dostępu do kont Garmin użytkowników.
Klucz nie występuje w kodzie, w repozytorium ani po stronie klienta.

---

## Izolacja danych — RLS

Każda tabela ma włączone RLS i polityki oparte wyłącznie na `auth.uid()`.
Nigdzie nie ma polityki dla roli `anon`.

```sql
CREATE POLICY "Właściciel aktualizuje swoje dni"
  ON public.longevity_daily_records FOR UPDATE
  USING (auth.uid() = user_id)          -- wiersz przed zmianą
  WITH CHECK (auth.uid() = user_id);    -- wiersz po zmianie
```

**Oba warunki są konieczne.** Bez `WITH CHECK` użytkownik mógłby przepisać
`user_id` na cudze konto i podrzucić komuś swoje dane zdrowotne.

Tabela `longevity_device_links` **celowo nie ma** polityk `INSERT`/`UPDATE` dla
roli `authenticated` — tokeny zapisują wyłącznie funkcje brzegowe na
`service_role`, bo tylko one mają klucz szyfrujący.

Widok statystyk administracyjnych:

```sql
REVOKE ALL ON public.longevity_admin_stats FROM anon, authenticated;
```

Dostęp przez `longevity_admin_dashboard()` (`SECURITY DEFINER` + `has_role`).
Widok bez `REVOKE` byłby czytelny dla każdego zalogowanego — nawet zagregowane
dane zdrowotne to informacja biznesowa.

---

## Minimalizacja danych wysyłanych do AI

Do modelu językowego trafia wyłącznie wynik `buildCoachContext()`:

**Trafia**: wyniki 0–100, stan układu nerwowego, prognozy bliźniaka, tytuły
wniosków, **przedział wiekowy** (`"40-49"`, nie `42`), płeć biologiczna, język.

**Nie trafia**: imię, e-mail, identyfikator użytkownika, identyfikatory
urządzeń, surowe szeregi czasowe, dokładny wiek, lokalizacja, historia rozmów
starsza niż 6 wiadomości.

Przedział zamiast dokładnego wieku to świadoma decyzja: dokładny wiek plus płeć
plus szczegółowy profil zdrowotny to zestaw kwazi-identyfikujący. Przedział
dziesięcioletni zachowuje użyteczność dla modelu (normy wiekowe są przedziałowe)
i obniża ryzyko ponownej identyfikacji.

Umowy powierzenia (art. 28) z dostawcą modelu są warunkiem uruchomienia
integracji AI na produkcji.

---

## Uwierzytelnianie

| Element | Stan |
| --- | --- |
| Konto | Współdzielone z Grouaistream (Supabase Auth) |
| Metody | E-mail + hasło, OAuth (Google, Apple) |
| Sesja | JWT, automatyczne odświeżanie, `persistSession` |
| **2FA** | TOTP — planowane, kwartał 2 roadmapy |
| **Biometria** | Face ID / Touch ID / odcisk — z aplikacją mobilną, kwartał 2 |
| Blokada aplikacji | Wymóg biometrii przy każdym wejściu — opcja, kwartał 2 |

Biometria i 2FA są zaplanowane, nie zadeklarowane jako gotowe. Aplikacja
webowa działa dziś na sesji Supabase; blokada biometryczna ma sens dopiero
w aplikacji natywnej, gdzie istnieje bezpieczny magazyn kluczy systemu.

---

## Kopie zapasowe i ciągłość

| Element | Parametr |
| --- | --- |
| Kopie bazy | Codzienne, retencja 30 dni |
| Point-in-time recovery | 7 dni |
| Eksport użytkownika | Na żądanie, bez limitu |
| Kopia lokalna | 400 ostatnich dni w `localStorage` |
| RPO | 24 h (baza), 0 h (pamięć lokalna) |
| RTO | 4 h |

Pamięć lokalna pełni rolę kopii ostatniej szansy: awaria bazy nie oznacza
utraty dziennika użytkownika, bo dane są też na jego urządzeniu.

---

## Retencja

| Dane | Okres | Uzasadnienie |
| --- | --- | --- |
| Rekordy dzienne | Do usunięcia konta | Wartość produktu rośnie z długością historii |
| Historia AI Coacha | 90 dni | Rozmowy nie są potrzebne do wyliczeń |
| Powiadomienia | 180 dni | Analiza skuteczności i limitów |
| `last_error` połączeń | Do udanej synchronizacji | Diagnostyka |
| Pamięć lokalna | 400 dni | Rok z zapasem; reszta w bazie |
| Logi funkcji brzegowych | 7 dni | Bez treści rozmów i bez wartości metryk |

---

## Bezpieczeństwo AI Coacha

### Wykrywanie objawów alarmowych

Przed wywołaniem modelu treść pytania jest sprawdzana pod kątem fraz
alarmowych (ból w klatce piersiowej, duszność, omdlenia, myśli samobójcze —
w wersji polskiej i angielskiej, z wariantami bez diakrytyków). Przy trafieniu
funkcja **nie wywołuje modelu** i zwraca stałą treść:

- numer alarmowy **112**,
- kryzysowy telefon zaufania **116 123**,
- Centrum Wsparcia **800 70 2222**,
- jasne stwierdzenie, że aplikacja nie ocenia objawów medycznych.

Model nie odpowiada, bo w tej jednej sytuacji jego kreatywność jest wadą.
Odpowiedź musi być identyczna za każdym razem i możliwa do przetestowania.

### Ochrona przed halucynacją

Model dostaje `groundTruth` — gotową odpowiedź silnika reguł — z instrukcją
„zachowaj sens i wszystkie liczby, popraw wyłącznie formę". Nie generuje
zaleceń od zera.

Przy braku klucza, limicie dostawcy albo błędzie sieci klient pokazuje wersję
regułową, oznaczoną w interfejsie. Użytkownik zawsze dostaje merytorycznie
tę samą poradę.

### Sygnały bezpieczeństwa z danych

`buildSafetyInsights()` podnosi wskazówkę na priorytet 1 przy:

| Sygnał | Próg | Komunikat |
| --- | --- | --- |
| SpO₂ | < 90% | Powtórz pomiar; przy powtórzeniu — konsultacja |
| Tętno spoczynkowe | > 90 bpm przez 3 dni | Ogranicz wysiłek, skonsultuj |
| Temperatura ciała | ≥ 38°C | Wstrzymaj treningi i protokoły hormetyczne |

Żaden z tych komunikatów nie nazywa choroby. Każdy prowadzi do jednego
działania: sprawdź ponownie, a jeśli się utrzymuje — idź do lekarza.

---

## Bezpieczeństwo ćwiczeń

Protokół Wima Hofa wymaga **wyraźnego potwierdzenia** przed startem
(`requiresConsent: true`), z trzema ostrzeżeniami:

- wyłącznie na siedząco lub leżąco, **nigdy w wodzie ani podczas prowadzenia
  pojazdu**,
- nie w ciąży, przy padaczce, chorobach serca ani nadciśnieniu bez konsultacji,
- przerwać przy zawrotach głowy lub dyskomforcie.

Przycisk startu jest nieaktywny do momentu zaznaczenia zgody. Pozostałe
protokoły mają ostrzeżenia kontekstowe (4-7-8: skróć zatrzymanie przy
zawrotach głowy; oddech aktywujący: nie przed snem).

---

## Lista kontrolna przed produkcją

- [x] RLS na wszystkich tabelach, brak polityk dla `anon`
- [x] `WITH CHECK` przy każdej polityce `UPDATE`
- [x] Kaskadowe usuwanie danych z kontem
- [x] Eksport i usunięcie z poziomu interfejsu
- [x] Zastrzeżenie medyczne na każdym ekranie z wynikiem
- [x] Wykrywanie objawów alarmowych przed wywołaniem modelu
- [x] Minimalizacja kontekstu wysyłanego do AI
- [x] Limit powiadomień wymuszony w bazie
- [x] Zgoda przed protokołami zaawansowanymi
- [ ] Umowa powierzenia z dostawcą modelu (art. 28)
- [ ] Ocena skutków dla ochrony danych (DPIA, art. 35)
- [ ] Rejestr czynności przetwarzania (art. 30)
- [ ] Polityka prywatności i regulamin — weryfikacja prawna
- [ ] 2FA (TOTP) — kwartał 2
- [ ] Blokada biometryczna — kwartał 2, z aplikacją mobilną
- [ ] Test penetracyjny przed publiczną premierą

**DPIA jest obowiązkowa** — przetwarzanie danych szczególnej kategorii na dużą
skalę z profilowaniem spełnia kryteria art. 35 ust. 3. Musi powstać przed
uruchomieniem produkcyjnym, nie po nim.
