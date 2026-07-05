# 🎯 Google Ads — pozyskiwanie leadów i remarketing (GrouAI Stream)

**Zasada legalności:** Google Ads to płatny, legalny kanał. Ty płacisz za reklamę →
człowiek sam klika i **dobrowolnie zostawia e-mail** na landingu (z checkboxem zgody
RODO) → dopiero wtedy masz leada, którego **wolno** remarketingować. To jest zgodne z
prawem, w przeciwieństwie do skrobania maili z internetu (czarna lista domeny + RODO).

Cała infrastruktura po naszej stronie już **działa i jest przetestowana**. Twoja część
to założyć konto Google Ads, wpiąć konwersję i włączyć kampanie (to Ty finansujesz).

---

## ✅ Co już działa (zrobione)

| Element | Adres |
|---|---|
| Landing B2B (firmy) | `grouaistream.com/lp/firma.html` |
| Landing Artyści | `grouaistream.com/lp/artysta.html` |
| Landing Słuchacze | `grouaistream.com/lp/sluchaj.html` |
| Silnik leadów (zapis + zgoda + mail powitalny) | funkcja huba `capture-lead` |
| Podgląd leadów (JSON) | `…/functions/v1/hub-leads?t=HUB_TOKEN` |
| Eksport pod remarketing (Customer Match) | `…/hub-leads?t=HUB_TOKEN&format=customer_match` |

- Landingi **łapią automatycznie `gclid` i `utm_*`** z adresu (Google dokleja je do URL).
- Każdy lead dostaje **mail powitalny** z `noreply@grouarock.com` (domena zweryfikowana).
- Lead **B2B** od razu tworzy zlecenie w Aurorze → hub generuje wstępną ofertę.
- Zapisujemy **tylko za zgodą** (checkbox) — RODO OK.

`HUB_TOKEN` = `377cc52bc557aacc2d2795f858d8a5b4ecb0d1c28af40188`

---

## 🔧 Krok 1 — konto Google Ads + konwersja (jednorazowo)

1. Załóż konto na **ads.google.com** (jeśli nie masz) i dodaj metodę płatności.
2. **Cele → Konwersje → + Nowa akcja konwersji → Witryna.**
   - Kategoria: **Prześlij formularz kontaktowy (Lead)**.
   - Nazwa: `Lead formularz`.
   - Zliczenie: **jedna** (jeden lead = jedna konwersja).
3. Google pokaże **Tag ID** (`AW-XXXXXXXXXX`) i **etykietę konwersji**.
4. Wklej je do pliku **`public/lp/lead.js`** (góra pliku, sekcja `GROUAI_LEAD_CONFIG`):
   ```js
   GOOGLE_ADS_ID: "AW-1234567890",        // Twój Tag ID
   CONVERSION_LABEL: "abCdEfGhIjKlMnOpQr", // Twoja etykieta
   ```
   Napisz mi „wpisz konwersję AW-… / label …", a ja to podmienię i wypchnę na stronę.
   Dopóki są `XX`, konwersje są po prostu wyłączone (reszta działa).

> Landingi już mają zaszyty `gclid` przy każdym leadzie, więc nawet bez tagu masz
> pełną atrybucję po stronie naszej bazy. Tag Google służy do optymalizacji kampanii
> przez algorytm Google (Smart Bidding).

---

## 📣 Krok 2 — trzy kampanie (search)

Ustaw **osobną kampanię na każdy segment** (inny odbiorca, inny landing, inny budżet).
Typ: **Search**, cel: **Potencjalni klienci (Leady)**, kraj: **Polska**, język: **polski**.

### Kampania A — FIRMY (B2B) 💼  → najwyższa wartość leada
- **Landing (Final URL):** `https://grouaistream.com/lp/firma.html`
- **Sugerowany budżet:** 30–50 zł/dzień na start
- **Słowa kluczowe (dopasowanie do wyrażenia / ścisłe):**
  `"audyt seo"`, `"pozycjonowanie strony"`, `"strona internetowa dla firmy"`,
  `"automatyzacja procesów"`, `"agencja marketingowa"`, `"landing page cena"`,
  `"treści na stronę"`, `[tania strona internetowa]`
- **Wykluczające:** `praca`, `kurs`, `za darmo`, `jak zrobić samemu`
- **Nagłówki reklamy (15 znaków limit x nagłówek — podaję gotowe):**
  - Marketing i SEO robione przez AI
  - Bezpłatna wycena w 24h
  - Taniej niż agencja
  - Audyt SEO + plan działań
  - Strona, treści, automatyzacje
- **Opisy:**
  - Zostaw kontakt — Aurora przygotuje ofertę dopasowaną do Twojej firmy. Bez zobowiązań.
  - SEO, landing pages, automatyzacje i treści. Szybko, konkretnie, po polsku.

### Kampania B — ARTYŚCI 🎵  → zasila katalog i radio
- **Landing:** `https://grouaistream.com/lp/artysta.html`
- **Budżet:** 15–25 zł/dzień
- **Słowa kluczowe:**
  `"gdzie wrzucić swoją muzykę"`, `"platforma dla muzyków"`, `"zarabianie na muzyce"`,
  `"dystrybucja muzyki"`, `"streaming dla artystów"`, `"jak zarabiać na streamingu"`
- **Wykluczające:** `spotify premium`, `pobierz`, `mp3 download`
- **Nagłówki:**
  - Zarabiaj na uczciwym streamingu
  - Zero botów, realne wypłaty
  - Wgraj muzykę — graj 24/7
  - Radio w autach i Teslach
- **Opisy:**
  - Weryfikowane odsłuchania, wypłaty za prawdziwych fanów. Dołącz jako artysta.
  - Twoja muzyka w Groua Radio 24/7 + promocja przez AI. Zostaw kontakt.

### Kampania C — SŁUCHACZE 🎧  → najszersza, subskrypcje Pro
- **Landing:** `https://grouaistream.com/lp/sluchaj.html`
- **Budżet:** 15–20 zł/dzień
- **Słowa kluczowe:**
  `"radio internetowe"`, `"muzyka do pracy"`, `"muzyka na nastrój"`,
  `"aplikacja do muzyki"`, `"streaming muzyki po polsku"`, `"muzyka ai"`
- **Wykluczające:** `spotify`, `youtube`, `za darmo mp3`, `pobierz`
- **Nagłówki:**
  - Muzyka, która czyta Twój nastrój
  - Radio na żywo 24/7
  - Pierwszy miesiąc Pro gratis
  - Streaming AI po polsku
- **Opisy:**
  - AI dopasowuje muzykę do Twojego nastroju w czasie rzeczywistym. Słuchaj za darmo.
  - Radio 24/7, AI DJ, playlisty pod nastrój. Zacznij bez karty.

> **Śledzenie:** ustaw w kampanii **auto-tagging** (domyślnie włączony) — Google sam
> dokleja `gclid`. Dodatkowo w URL możesz dopisać `?utm_campaign=b2b-krakow` itd., a my
> zapiszemy to przy leadzie (widać w podglądzie).

---

## ♻️ Krok 3 — remarketing (wykorzystanie leadów do reklamy)

To legalnie „wykorzystanie leadów do reklamy" — bo mamy zgodę marketingową:

1. **Customer Match (dopasowanie klientów):**
   - Pobierz listę zgodnych maili:
     `…/functions/v1/hub-leads?t=HUB_TOKEN&format=customer_match` → plik CSV (kolumna `Email`).
   - W Google Ads: **Odbiorcy → Twoje dane → + → Lista klientów → wgraj CSV.**
   - Zaznacz, że **dane zebrano za zgodą** (mamy checkbox + timestamp w bazie).
   - Użyj tej listy do: **remarketingu** (docieraj ponownie) oraz **Lookalike/podobni
     odbiorcy** (Google znajdzie nowych, podobnych do Twoich leadów).
2. **Remarketing na stronie:** gdy wgrasz tag Google Ads (Krok 1), możesz kierować
   reklamy displayowe do osób, które weszły na landing, ale nie zostawiły maila.

---

## 📊 Podgląd leadów (dla Ciebie)

- **Na żywo (JSON):** `…/functions/v1/hub-leads?t=HUB_TOKEN`
  → liczby wg segmentu, ile zgód, ostatnie 100 leadów, linki do eksportów.
- **CSV do Excela:** `…/hub-leads?t=HUB_TOKEN&format=csv`
- Leady **B2B** widać też w panelu **Admin → Aurora → Zlecenia** (Aurora robi ofertę).

---

## 💡 Zasady, żeby nie przepalać budżetu

- Zacznij **mało** (łącznie ~60–90 zł/dzień na 3 kampanie), obserwuj 5–7 dni.
- Wyłączaj słowa, które generują kliki bez leadów (raport „wyszukiwane hasła").
- Najpierw skaluj **kampanię B2B** — jeden klient usługowy (199 €+) zwraca dziesiątki kliknięć.
- Gdy konwersje ruszą, przełącz strategię na **„Maksymalizuj liczbę konwersji"**.

**Twoja jedyna płatność:** budżet Google Ads. Reszta (landingi, maile, baza, Aurora,
remarketing-eksport) działa u nas za darmo.
