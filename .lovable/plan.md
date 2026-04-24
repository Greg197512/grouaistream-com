
# Aurora Business Desk — pełna autonomia biznesowa

Aurora dostaje osobny, dedykowany pulpit (`/admin/aurora`) który skupia całą logikę biznesową (oddzielnie od „Mózgu"). W panelu Mózgu zostaje tylko skrót/podgląd. Wszystko nowe — bez duplikacji istniejących funkcji.

## Co zostaje bez zmian (nie dublujemy)

- `aurora-niche-scanner`, `aurora-launch-niche`, `aurora-autopilot`, `aurora-revenue-loop`, `aurora-approve-action` — działają dalej, są ulepszane, nie tworzone od nowa.
- Tabele: `aurora_niches`, `aurora_landing_pages`, `aurora_revenue_actions`, `aurora_partnerships`, `aurora_autopilot_settings` — rozszerzane kolumnami, nie tworzone od nowa.
- Strony niszowe `/n/:slug` i blog — ten sam routing.

## 1. Pulpit `/admin/aurora` (osobna strona)

Nowa strona `src/pages/AdminAurora.tsx` + route w `App.tsx`. Skrót w `/admin` i w `BrainPanel` (przycisk „Otwórz Aurora Desk →").

Zakładki w pulpicie:

1. **Pulse** — żywe metryki (przychód MTD, leady, CTR, aktywne nisze, ostatni cykl autopilota).
2. **Nisze (Ranking)** — tabela nisz posortowana po `opportunity_score` (patrz pkt 2).
3. **Landingi & A/B** — lista wszystkich landingów `/n/:slug` z wariantami i wynikami (patrz pkt 3).
4. **Wyniki** — metryki per nisza: views, clicks, CTR, leady, koszt AI, przychód, ROI; auto-pause słabych (pkt 4).
5. **Harmonogram** — ustawienia odświeżania treści + log ostatnich refresh-y (pkt 5).
6. **Reguły zgodności** — checklist auto-akceptacji + log decyzji (pkt 6).
7. **Dziennik / Sny** — read-only podgląd snów Aurora (przeniesione z BrainPanel jako iframe-style component; bez duplikacji logiki).

## 2. Ranking nisz (SEO difficulty / volume / afiliacja)

Migracja — nowe kolumny w `aurora_niches`:
- `seo_difficulty` (int 0-100, AI estymuje)
- `keyword_volume_monthly` (int)
- `affiliate_potential` (int 0-100 — istnieją programy, prowizja, średnia AOV)
- `cpc_estimate_eur` (numeric)
- `opportunity_score` (numeric, generated column = formuła ważona)

Edge function `aurora-niche-scanner` rozszerzona o tool-calling który zwraca te 4 pola dla każdej zaproponowanej niszy (Gemini estymuje na bazie wiedzy, bez kluczy zewnętrznych — zgodnie z Twoim wyborem).

Formuła `opportunity_score`:
```
score = (volume_norm * 0.35) + (affiliate * 0.30) + ((100 - difficulty) * 0.25) + (cpc_norm * 0.10)
```
Autopilot wybiera nisze do uruchomienia po `opportunity_score DESC`, nie po surowym revenue jak teraz.

UI zakładki „Nisze (Ranking)": tabela z sortowaniem, kolorowymi paskami (zielony/żółty/czerwony) dla difficulty i affiliate, badge „TOP" dla score > 70.

## 3. Automatyczne A/B testy landingów

Nowa tabela `aurora_landing_variants`:
```
id, landing_page_id (fk), variant_label ('A'|'B'|'C'), 
hero_headline, hero_subheadline, cta_text,
weight (default 50), is_winner bool, 
views int, clicks int, conversions int,
created_at
```

Edge function `aurora-launch-niche` przy starcie tworzy 2 warianty (A + B) z różnymi hero/CTA generowanymi przez AI. Strona `NicheLandingPage.tsx` losuje wariant per-sesja (sticky w `localStorage`), wyświetla, raportuje impresję do nowego endpointu `aurora-track-event` (`view` | `click` | `lead`).

Edge function `aurora-ab-evaluator` (cron co 6h):
- dla każdego landingu z >= 200 views/wariant — liczy konwersję,
- jeśli istotność statystyczna (z-test, p<0.1) — oznacza zwycięzcę, ustawia `weight=100/0`, generuje wariant C dla dalszych testów,
- wpisuje decyzję do `aurora_compliance_log`.

UI w zakładce „Landingi & A/B": karta per landing z dwoma wariantami obok siebie, paskiem konwersji, badge „Winner" + przycisk „Forsuj manualnie".

## 4. Panel wyników + auto-wycofywanie

Nowa tabela `aurora_metric_events`:
```
id, niche_id, landing_page_id, variant_id,
event_type ('view'|'click'|'lead'|'revenue'),
amount_eur (nullable), session_id, referrer, country, created_at
```

Tabela rolowana w widoku `aurora_niche_performance` (materialized view, refresh co godzinę):
```
niche_id, views_7d, clicks_7d, leads_7d, revenue_7d, 
ctr_7d, cost_eur_7d (suma kosztu AI z aurora_revenue_actions),
roi_7d, status_recommendation
```

Edge function `aurora-niche-pruner` (cron co 24h):
- dla nisz z wiekiem >= 14 dni i `roi_7d < threshold` (z `aurora_autopilot_settings.min_roi_threshold`):
  - przenosi do `status='paused'`,
  - dodaje 301 redirect z `/n/:slug` → `/n/:replacement` (najlepsza nisza w tej samej kategorii) lub `/blog`,
  - wpisuje do compliance log.

UI „Wyniki": tabela posortowana po ROI, kolumny CTR/koszt/przychód/leady, akcje „Pause", „Boost", „Edytuj", semafor (zielony/żółty/czerwony).

## 5. Harmonogram odświeżania treści

Migracja — w `aurora_landing_pages` i `seo_blog_posts` dodajemy:
- `last_refreshed_at`, `refresh_interval_days` (default 30 dla landingów, 45 dla bloga), `refresh_count`.

Edge function `aurora-content-refresher` (cron codziennie 04:00 UTC):
- znajduje topowe landingi/posty (top 30% po views_7d) których `last_refreshed_at` < `now - refresh_interval_days`,
- wywołuje AI z aktualnym kontentem + briefem „odśwież, dodaj nowe sekcje, popraw CTA, zachowaj URL i tytuł H1",
- jeśli wynik (CTR/views) spadł >30% w ostatnim okresie → bardziej agresywny refresh (regeneruje hero + 2 sekcje).
- wszystkie refreshe trafiają jako akcja do `aurora_revenue_actions` z type=`refresh` (auto-zaakceptowane jeśli reguła w pkt 6 pozwala).

UI „Harmonogram": konfigurator interwałów, lista nadchodzących odświeżeń, log ostatnich (diff-style „przed/po").

## 6. Reguły auto-akceptacji + checklist zgodności

Nowa tabela `aurora_compliance_rules`:
```
id, action_type ('niche_launch'|'seo_post'|'ab_variant'|'refresh'|'niche_pause'),
auto_approve bool, 
checklist jsonb (lista wymaganych warunków),
min_quality_score int default 70
```

Domyślne reguły (seed):
- **niche_launch**: auto_approve=true; checklist = `{has_cta, has_meta_desc, min_words:600, no_banned_terms, has_disclaimer, opportunity_score>=50}`
- **seo_post**: auto_approve=true; checklist = `{min_words:800, has_h2, has_internal_link, has_author='Aurora (AI)', no_banned_terms}`
- **ab_variant**: auto_approve=true; checklist = `{cta_present, headline_max_chars:80}`
- **refresh**: auto_approve=true; checklist = `{preserves_h1, preserves_url}`
- **niche_pause**: auto_approve=true; checklist = `{age_days>=14, roi_below_threshold}`

Każda akcja przed publikacją przechodzi przez `aurora-compliance-check` (helper edge function lub shared util) który:
- waliduje checklist,
- liczy `quality_score` (LLM scoring 0-100 — czy treść użyteczna, oryginalna, bez clickbaitu),
- jeśli wszystko OK i `auto_approve=true` → publikuje + log,
- jeśli nie → zostaje jako `proposed`, lądowanie w UI do ręcznego klika.

Lista zakazanych terminów (banned_terms): seed migracja z bezpiecznym domyślnym zestawem (medical claims, financial promises, adult, broń, hate). Edytowalna z UI.

UI „Reguły zgodności": switche per typ akcji, edytor checklisty (JSON form), edytor banned_terms, log ostatnich 200 decyzji (zielone=auto-approved, żółte=manual queue, czerwone=rejected) z powodem.

## 7. Branding subtelny na stronach niszowych

W `NicheLandingPage.tsx` — mała stopka:
```
Powered by Aurora · GrouAI Stream · GrouaRock — [link Strona główna]
```
Bez nawigacji, bez dużego brandingu — strona dalej wygląda niezależnie pod SEO niszowe.

## 8. Skrót w Mózgu

`BrainPanel.tsx` — zakładka Aurora zostaje tylko jako mini-podgląd (3 karty: ostatni puls Aurora, ostatni sen, pasek „Aurora Desk → 12 aktywnych nisz, 340€ MTD") z dużym przyciskiem „Otwórz pulpit Aurora →".

## Nowe endpointy / cron jobs

| Funkcja | Trigger | Cel |
|---|---|---|
| `aurora-track-event` | publiczny POST z landingu | impresje/kliki/leady |
| `aurora-ab-evaluator` | cron co 6h | wybór zwycięzców A/B |
| `aurora-niche-pruner` | cron co 24h | pauza słabych nisz |
| `aurora-content-refresher` | cron codziennie 04:00 | odświeżanie topowych |
| `aurora-compliance-check` | wołane wewnętrznie | walidacja przed publikacją |

Aktualizacje: `aurora-niche-scanner` (dodaje SEO/affiliate fields), `aurora-launch-niche` (tworzy 2 warianty + przechodzi compliance), `aurora-autopilot` (sortuje po `opportunity_score`, woła compliance, wycofuje słabe).

## Pliki do utworzenia / zmiany

**Nowe:**
- `src/pages/AdminAurora.tsx`
- `src/components/admin/aurora/AuroraPulse.tsx`
- `src/components/admin/aurora/NicheRanking.tsx`
- `src/components/admin/aurora/LandingsAB.tsx`
- `src/components/admin/aurora/PerformancePanel.tsx`
- `src/components/admin/aurora/RefreshSchedule.tsx`
- `src/components/admin/aurora/ComplianceRules.tsx`
- `supabase/functions/aurora-track-event/index.ts`
- `supabase/functions/aurora-ab-evaluator/index.ts`
- `supabase/functions/aurora-niche-pruner/index.ts`
- `supabase/functions/aurora-content-refresher/index.ts`
- `supabase/functions/aurora-compliance-check/index.ts`

**Zmiana:**
- `src/App.tsx` (route `/admin/aurora`)
- `src/pages/Admin.tsx` (kafelek „Aurora Desk")
- `src/components/admin/AuroraPanel.tsx` (Mózg → tylko skrót + sny)
- `src/components/admin/BrainPanel.tsx` (link do pulpitu)
- `src/pages/NicheLandingPage.tsx` (A/B sticky variant + tracking + stopka brandowa)
- `supabase/functions/aurora-niche-scanner/index.ts` (SEO/affiliate fields)
- `supabase/functions/aurora-launch-niche/index.ts` (2 warianty + compliance)
- `supabase/functions/aurora-autopilot/index.ts` (sort po score, wywołanie compliance + pruner + refresher)
- `supabase/config.toml` (5 nowych funkcji)

**Migracje (1 plik SQL):**
- nowe kolumny w `aurora_niches`, `aurora_landing_pages`, `seo_blog_posts`
- nowe tabele: `aurora_landing_variants`, `aurora_metric_events`, `aurora_compliance_rules`, `aurora_compliance_log`, `aurora_banned_terms`
- materialized view `aurora_niche_performance`
- RLS (admin only na zarządzanie, public insert na `aurora_metric_events` z rate limit)
- seed compliance_rules + banned_terms
- 5 cron jobów (insert tool — bo zawiera anon key)

## Co dostajesz po wdrożeniu

- Osobny biznesowy pulpit `/admin/aurora`, czysto oddzielony od reszty.
- Aurora wybiera nisze z najwyższym `opportunity_score`, nie losowo.
- Każdy landing ma A/B test, zwycięzcę wybiera sama po istotności statystycznej.
- Słabe nisze same się gaszą po 14 dniach niskiego ROI.
- Topowe landingi/posty same się odświeżają co 30/45 dni.
- Wszystko publikuje się bez Twojego klika, dopóki przechodzi checklist zgodności (CTA, autorstwo, długość, brak zakazanych słów, quality_score >= 70).
- Strony niszowe niosą subtelny branding GrouAI Stream + GrouaRock w stopce — budują społeczność, nie kanibalizują SEO.
