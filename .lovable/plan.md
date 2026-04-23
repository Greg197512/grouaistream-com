

# 💰 Auto-raportowanie kosztów + nowa mapa finansowa

## Co dostajesz

1. **Czytelna mapa myśli** — pokolorowana, pogrupowana w 5 obszarów, łatwa do skanowania wzrokiem
2. **Automatyczny system kosztów** — każdego 1. dnia miesiąca system sam zapisuje do bazy:
   - **Koszty stałe** (Lovable, n8n, ElevenLabs, Suno) z tabeli `operational_costs`
   - **Koszty zmienne** wyliczone z realnego użycia: R2 storage, ElevenLabs znaki, Suno generacje, AI Gateway, Paddle prowizje
3. **Panel admina "Cost Reports"** — historia miesięcy, breakdown każdej kategorii, trend wzrostu

---

## CZĘŚĆ 1: Nowa mapa myśli (czytelniejsza)

Zamiast jednego gęstego mindmapa zrobię **3 osobne diagramy** w jednym pliku:
- 🔴 **Strona kosztów** (co Cię zjada)
- 🟢 **Strona przychodów** (skąd ma wpływać)
- 🎯 **Plan działania** (co robić w jakiej kolejności — flowchart)

Każdy diagram pokolorowany, pogrupowany, z liczbami EUR, max 4 poziomy zagnieżdżenia.

---

## CZĘŚĆ 2: Automatyczne raportowanie kosztów

### Nowa tabela `monthly_cost_reports`

```text
┌─────────────────────────────────────────────────┐
│  monthly_cost_reports                           │
├─────────────────────────────────────────────────┤
│  id              uuid                           │
│  report_month    date     (np. 2026-04-01)     │
│  category        text     (fixed/variable)      │
│  service_name    text     (Lovable, R2, Suno…) │
│  amount_eur      numeric  (wyliczona kwota)    │
│  usage_metric    jsonb    ({"gb": 12, "calls"…})│
│  notes           text                           │
│  created_at      timestamptz                    │
└─────────────────────────────────────────────────┘
```

RLS: tylko admin czyta i zapisuje. Trigger pilnuje unikalności `(report_month, service_name)`.

### Edge function `monthly-cost-report` (cron 1. dnia miesiąca o 03:00 UTC)

Logika:

```text
1. KOSZTY STAŁE (z operational_costs)
   ├── Lovable.dev      50 €
   ├── n8n              30 €
   ├── ElevenLabs       25 €
   └── Suno API         20 €
   → zapis 4 wierszy z category='fixed'

2. KOSZTY ZMIENNE (wyliczone z bazy za poprzedni miesiąc)
   ├── R2 Storage      = (suma audio_file_size_mb tracks) / 1024 × 0,015 €/GB
   ├── R2 Egress       = (stream_events count × średni rozmiar) × 0,01 €/GB
   ├── ElevenLabs TTS  = (znaki w tts_logs) × 0,18 €/1k znaków
   ├── Suno generacje  = (tracks z audio_url ILIKE '%suno%' za miesiąc) × 0,05 €
   ├── AI Gateway      = (ai_gateway_calls count × średnia cena tokenów)
   ├── Paddle prowizje = (sum paddle_transactions) × 0,05 + 0,50 × count
   └── Cover AI        = (count auto-generated covers) × 0,04 €
   → zapis ~7 wierszy z category='variable'

3. AGREGACJA ŁĄCZNA
   ├── total_fixed     = sum(fixed)
   ├── total_variable  = sum(variable)
   └── total_eur       = sum wszystkich
   → zapis 1 wiersz z category='summary'

4. PORÓWNANIE Z POPRZEDNIM MIESIĄCEM
   → wyliczenie delta % i zapis do brain_memory jako "raport miesięczny"
```

### Cron schedule

W `pg_cron` (już jest enabled):
- **Codzienna mini-aktualizacja**: o 02:00 UTC liczy bieżący miesiąc na bazie dotychczasowego użycia (live preview)
- **Miesięczny finalny raport**: 1. dnia miesiąca o 03:00 UTC zamyka poprzedni miesiąc

---

## CZĘŚĆ 3: Panel "Cost Reports" w adminie

Nowa zakładka w `/admin` → **💸 Koszty**:

```text
┌──────────────────────────────────────────────────┐
│  Bieżący miesiąc (live)        Kwiecień 2026     │
│  ─────────────────────────────────────────────   │
│  Stałe:        125,00 €    [Lovable, n8n, ...]  │
│  Zmienne:       42,30 €    [R2, AI, Paddle]     │
│  RAZEM:        167,30 €  ⬆ +12% wzgl. marca     │
│                                                  │
│  [Wygeneruj teraz]  [Eksport CSV]               │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Historia 6 miesięcy (wykres słupkowy)          │
│  ███▌  Mar  148 €                                │
│  ████  Kwi  167 €  ←                             │
│  ...                                             │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Breakdown bieżącego miesiąca (tabela)          │
│  Lovable.dev      50,00 €  fixed                │
│  ElevenLabs       25,00 €  fixed                │
│  R2 Storage       18,40 €  variable  12 GB      │
│  Suno generacje    8,50 €  variable  170 utw.   │
│  ...                                             │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  💡 Sugestie oszczędności (z AI)                │
│  • R2 wzrosło o 35% — rozważ kompresję mp3      │
│  • ElevenLabs nieużywane — downgrade do Starter │
└──────────────────────────────────────────────────┘
```

---

## Pliki do stworzenia/edycji

**Nowe:**
- `supabase/migrations/<nowy>.sql` — tabela `monthly_cost_reports`, RLS, trigger unikalności, RPC `get_cost_report_summary`
- `supabase/functions/monthly-cost-report/index.ts` — edge function liczący koszty
- `src/components/admin/CostReportsPanel.tsx` — panel admina z wykresem i breakdown

**Edycje:**
- `src/pages/Admin.tsx` — dodanie zakładki "💸 Koszty"
- Cron przez `pg_cron` + `pg_net` — zapis przez insert tool (nie migracja, bo zawiera klucz)

**Nowy artefakt mapy:**
- `/mnt/documents/GrouAI_Mapa_Finansowa_v2.mmd` — czytelna, pokolorowana, 3 sekcje

---

## Założenia liczbowe (do weryfikacji w realnym czasie)

| Pozycja zmienna | Stawka | Skąd liczba |
|---|---|---|
| R2 Storage | 0,015 €/GB/mc | Cloudflare R2 cennik |
| R2 Egress | 0 €/GB | R2 ma free egress |
| ElevenLabs | 0,18 €/1k znaków | Creator plan |
| Suno API | 0,05 €/generacja | Suno API |
| Lovable AI Gateway | wg Settings → Cloud & AI | live z Twojego konta |
| Paddle | 5% + 0,50 €/tx | Paddle standard |
| Cover AI (Gemini) | 0,04 €/obraz | Gemini Flash Image |

Stawki będą trzymane jako **stałe w funkcji** — łatwo zmienić w jednym miejscu jak Cloudflare/Suno zmieni cennik.

---

## Co zyskujesz

1. **Codziennie wiesz na żywo**, ile Cię realnie kosztuje miesiąc — nie zgadywanie
2. **Historia 12 miesięcy** w wykresie — widzisz trend wzrostu
3. **Sugestie oszczędności** generowane automatycznie (np. "R2 wzrosło o 35% — sprawdź czy nie masz duplikatów")
4. **Eksport CSV** do księgowości
5. **Powiązanie z przychodami** — w panelu finansowym zobaczysz **margin %** (przychód − koszty)

