## Cel

1. **Posegregować bloga technicznie do zakładek** — obecnie mamy 55 opublikowanych postów rozsianych po 33 różnych wartościach `category` (np. "Zero Waste Lifestyle", "Digital Wellness", "Shopify Automation"...). Filtry w `/blog` znają tylko 10 sztywnych kategorii (`sound_chronicles`, `ai_news`, `tech_news`...), więc kliknięcie zakładki nie pokazuje większości postów.
2. **Dodać grafikę do panelu Grok** (StudioGrokDock w studio).

---

## Część 1 — Normalizacja kategorii bloga

### Mapowanie 33 → 10 kanonicznych kategorii

Wszystkie obecne wartości zostaną zmapowane do istniejących slugów z `src/lib/blogCategories.ts`:

| Surowa kategoria | → kanoniczne `id` |
|---|---|
| `Zero Waste Lifestyle`, `Sustainable living`, `Eco-Friendly Printing`, `Eco-Friendly 3D Printing`, `Sustainable 3D Printing`, `Eco-Friendly 3D Printing Materials`, `Community & Zero Waste`, `Community Living`, `lifestyle` | **`industry`** (Branża/eco) |
| `Shopify Automation`, `E-commerce Automation`, `Ecommerce Automation`, `Workflow Automation`, `Marketing Automation`, `marketing`, `E-commerce Compliance`, `Legal Compliance` | **`tools`** (Narzędzia/automatyzacja) |
| `Productivity & Operations`, `Productivity & Workflow`, `Workspace Optimization`, `Workplace Ergonomics` | **`tutorial`** (Tutoriale/produktywność) |
| `Digital Wellness`, `Digital Wellness & Remote Work` | **`psychology`** |
| `Technologia i Kultura`, `Technologia i Styl Życia` | **`tech_news`** |
| Pozostałe (`sound_chronicles`, `ai_news`, `monetization`, `tutorial`, `feature`, `trends`, `industry`, `psychology`) | bez zmian |

### Zmiany w bazie

Migracja SQL `UPDATE seo_blog_posts SET category = ...` na podstawie mapy powyżej. Po migracji 100% postów wpadnie do jednej z 10 zakładek widocznych na `/blog`.

### Zmiany w UI (`src/pages/BlogIndex.tsx`)

- **Zakładki techniczne** — zamiana okrągłych chipów filtrów na pełnowartościowy `Tabs` (shadcn) z licznikiem postów w każdej zakładce, np. `🔥 AI News (6)`, `🎼 Kroniki Dźwięku (10)`, `Branża (12)`, `Narzędzia (10)`, itd.
- Zachowane wyszukiwanie + featured post na górze.
- Sticky tab bar przy scrollu (drobne UX).
- Brak zmian w SEO/i18n (kategorie używają istniejącego `getCategoryLabel`).

---

## Część 2 — Grafika "Grok" w studio

Komponent `src/components/studio/StudioGrokDock.tsx` jest "dockem" Grok-asystenta w studio. Dodam dedykowaną grafikę awatara/loga:

- **Generacja** przez Lovable AI (`google/gemini-3.1-flash-image-preview`) — neonowo-pomarańczowy portret AI w stylu aurora/cyber, spójny z brandingiem GrouAI.
- Zapis do `src/assets/grok-avatar.jpg` i wstawienie do nagłówka docka (zamiast obecnej ikony tekstowej, jeżeli jest).
- Lekka ramka z efektem `shadow-[0_0_30px_hsl(var(--primary)/0.4)]`, bez ciężkich animacji.

---

## Pliki do zmiany

```text
supabase/migrations/<new>.sql        — UPDATE seo_blog_posts.category (mapowanie 33→10)
src/pages/BlogIndex.tsx              — Tabs zamiast chipów, liczniki, sticky bar
src/components/studio/StudioGrokDock.tsx  — wstawienie grafiki Grok
src/assets/grok-avatar.jpg           — nowa grafika (Lovable AI)
```

Bez zmian w `blogCategories.ts` (10 kanonicznych slugów już istnieje).

---

## Co użytkownik zobaczy

- `/blog` — czytelne zakładki techniczne z licznikami, każdy z 55 postów wpada do właściwej szuflady.
- Studio → Grok dock — nowa, spójna brandowo grafika awatara zamiast surowej ikony.
