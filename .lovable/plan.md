

# 🚀 Pełne uruchomienie systemu finansowego — "wszystko ma żyć"

## Co robię w tym kroku

Domykam pętlę z poprzedniego planu tak, żeby system kosztów + przychodów działał **w pełni autonomicznie 24/7** — bez Twojej ingerencji. Dokładam też brakujące elementy, których jeszcze nie ma:

1. **Panel Break-even na żywo** — admin widzi dziś / w tym miesiącu ile brakuje do zera
2. **Auto-aktywacja cron jobs** — pewność, że raport faktycznie odpala się codziennie
3. **Powiadomienia progowe** — gdy koszty przekroczą 80% / 100% / 150% przychodu
4. **Eksport CSV** kosztów do księgowości
5. **Widget przychodów** połączony z kosztami → realny **margin %** dziennie

---

## 1. Panel Break-even (`BreakEvenPanel.tsx`)

Nowa zakładka w `/admin` → **"Break-even"** pokazuje:

- 💸 **Koszty miesiąca dziś (live)** — np. `181 €`
- 💰 **Przychody miesiąca dziś** — suma z `subscriptions` (Pro 4,99 / Ultimate 9,99) + `tip_transactions` (10% platform fee) + paid boosts
- 🎯 **Break-even gap** — różnica `koszty − przychody`. Czerwone gdy ujemne, zielone gdy dodatnie.
- 📊 **Pasek postępu** "Ile dni do końca miesiąca / ile musisz zarobić dziennie"
- 👥 **Ile subskrypcji brakuje** do break-even (gap ÷ 4,99 € = liczba Pro lub gap ÷ 9,99 € = liczba Ultimate)
- 📈 **Wykres dzienny** — koszty vs. przychody narastająco od 1. dnia miesiąca

```text
┌─────────────────────────────────────────┐
│  KOSZT DZIŚ:    181,42 €                │
│  PRZYCHÓD DZIŚ:  47,80 €                │
│  ─────────────────────                  │
│  GAP:           -133,62 € 🔴            │
│                                         │
│  Brakuje: 27 × Pro (4,99€)              │
│  lub:     14 × Ultimate (9,99€)         │
│                                         │
│  [████░░░░░░] 35% miesiąca              │
└─────────────────────────────────────────┘
```

## 2. RPC `get_break_even_status()`

Nowa funkcja DB (security definer, admin only):
- Sumuje `monthly_cost_reports` dla bieżącego miesiąca (live preview)
- Sumuje przychody MTD: aktywne subskrypcje × stawka prorata + tip platform fees
- Zwraca JSON z gap, dni_do_końca_miesiąca, wymagana_dzienna_średnia_przychodu

## 3. Cron jobs — gwarancja działania

Dorzucam dwa joby przez `supabase_insert` (NIE migrację, bo zawierają anon key):

- `monthly-cost-report-daily` — codziennie o 02:00 UTC (preview live)
- `monthly-cost-report-finalize` — 1. dnia miesiąca o 03:00 UTC (zamknięcie poprzedniego miesiąca)
- `break-even-alert` — codziennie o 09:00 UTC (sprawdza progi i loguje alert do tabeli)

## 4. Powiadomienia progowe (`cost_alerts` table)

Nowa tabela:
```text
cost_alerts(id, level, message, gap_amount, triggered_at, dismissed_at)
```
- Próg **80%** kosztów wzgl. przychodu → żółty banner w `/admin`
- Próg **100%** → czerwony banner "TRACISZ PIENIĄDZE"
- Próg **150%** → krytyczny + sugestie cięć (wyłącz n8n, downgrade ElevenLabs)

Banner pojawia się **na górze panelu admin** dopóki nie klikniesz "Rozumiem".

## 5. Eksport CSV

Przycisk **"Eksportuj CSV"** w `CostReportsPanel` → generuje plik z kolumnami:
`miesiąc, kategoria, serwis, kwota_eur, jednostki, opis` — gotowe do księgowości / VAT-7.

## 6. Aktualizacja `CostReportsPanel.tsx`

- Dorzucam zakładkę "Margin" → wykres przychód − koszty miesięcznie (12 mc)
- Pokazuję **Margin %** = `(przychód − koszt) / przychód × 100`
- Wskaźnik "Runway" = `aktualne saldo banku ÷ średni miesięczny burn` (pole do ręcznego wpisania salda)

---

## Pliki do utworzenia / edycji

**Nowe:**
- `supabase/functions/break-even-alert/index.ts` — sprawdza progi, loguje do `cost_alerts`
- `src/components/admin/BreakEvenPanel.tsx` — główny widok live
- `src/components/admin/CostAlertBanner.tsx` — banner ostrzegawczy na górze /admin
- `supabase/migrations/<ts>_break_even_system.sql`:
  - tabela `cost_alerts` (RLS: admin only)
  - RPC `get_break_even_status()` (security definer)
  - RPC `get_revenue_mtd()` (sumuje subskrypcje + tipy w bieżącym miesiącu)
  - RPC `dismiss_cost_alert(_id uuid)`

**Edytowane:**
- `src/pages/Admin.tsx` — nowa zakładka "Break-even" + montaż `CostAlertBanner` na górze
- `src/components/admin/CostReportsPanel.tsx` — przycisk "Eksportuj CSV" + zakładka "Margin"

**SQL przez supabase_insert (nie migracja — zawiera klucze):**
- 3 cron joby (daily report, monthly finalize, break-even alert)

---

## Wartość dla Ciebie

Po tym kroku:

1. **Otwierasz `/admin` i od razu widzisz**, czy dziś tracisz czy zarabiasz
2. **System sam Cię ostrzega**, gdy zaczynasz tracić — nie musisz pamiętać sprawdzać
3. **Wiesz dokładnie**, ile osób dziś musi kupić Pro/Ultimate, żeby wyjść na zero
4. **Eksportujesz CSV do księgowej** jednym kliknięciem
5. **Cron działa autonomicznie** — nawet gdy śpisz, raport się aktualizuje

Po wdrożeniu **system finansowy żyje sam** — Twoja rola to tylko reagowanie na alerty.

