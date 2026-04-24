

# 📧 Naprawa „Dodatkowy kontekst" w generatorze maili (admin)

## Co jest zepsute (prawda z kodu)

1. **`supabase/functions/generate-email/index.ts`** — funkcja AI która generuje maila do testu pojedynczego odbiorcy:
   - Typ `EmailRequest.type` akceptuje TYLKO 5 wartości: `invitation | challenge | newsletter | weekly_digest | easter`.
   - **10 nowszych typów** widocznych w dropdownie admina (`feature_announcement`, `tip_of_the_week`, `blog_post`, `milestone`, `comeback`, `thank_you`, `ai_studio_promo`, `live_radio_promo`, `party_mode_promo`, `custom`) **nie mają żadnego case'a** w `switch (type)` → `userPrompt` zostaje pustym stringiem `""` → AI dostaje tylko system prompt bez żadnego kontekstu → ignoruje `customMessage`.
   - Dla 5 obsługiwanych typów `customMessage` jest doklejany, ale opisany niespójnie (raz „Kontekst", raz „Temat challenge", raz „Główny temat", raz „Dodatkowy kontekst"). System prompt narzuca sztywną strukturę i limit 120 słów → AI często topi krótki dopisek admina.

2. **`AdminEmailDashboard.tsx` → `sendEmail()`**: bierze `generatedEmail.body.replace(/<[^>]*>/g, "")` i wsadza w pole `message` szablonu `admin-notification`. Czyli jeśli AI zignoruje kontekst → kontekst NIE pojawi się w mailu. Nie ma żadnego fallbacku.

## Co naprawiam

### A. `supabase/functions/generate-email/index.ts` (główny fix)

1. **Rozszerzam typ `EmailRequest.type`** o wszystkie 15 wariantów z dropdownu admina (`feature_announcement`, `tip_of_the_week`, `blog_post`, `milestone`, `comeback`, `thank_you`, `ai_studio_promo`, `live_radio_promo`, `party_mode_promo`, `custom` + 5 istniejących).
2. **Dodaję `case` dla każdego brakującego typu** z konkretnym promptem dopasowanym do funkcji platformy (AI Studio, Live Radio, Party Mode, Mood detection itd.).
3. **Ujednolicam użycie `customMessage`** — w KAŻDYM case'ie dodaję na początku promptu twardą instrukcję:
   ```
   ⚠️ KRYTYCZNE: Admin podał następujący kontekst, który MUSI pojawić się w treści maila (sparafrazowany lub dosłownie, ale jasno widoczny dla odbiorcy):
   "${customMessage}"
   ```
   gdy `customMessage` jest podany. Bez tego AI zignoruje krótki tekst.
4. **Case `custom`** (typ „Własna wiadomość") = AI ma użyć `customMessage` jako głównej treści maila, a nie własnej kreacji.
5. **Walidacja**: jeśli typ jest nieznany → fallback do `custom` zamiast pustego promptu.

### B. `AdminEmailDashboard.tsx` (bezpiecznik po stronie wysyłki)

W `sendEmail()` dodaję fallback: jeśli `customMessage` jest podany i NIE występuje w `generatedEmail.body` (case-insensitive, pierwsze 30 znaków) → doklejam go do `message` jako sekcję „Kontekst od redakcji:". Gwarantuje, że kontekst zawsze trafi do maila, nawet jeśli AI go zgubi.

### C. Drobny UX

W labelu pola w UI: `Dodatkowy kontekst (opcjonalne)` → `Dodatkowy kontekst (zostanie wpleciony w treść maila)` + krótki helper text.

## Co NIE jest zmieniane

- `mass-email-dispatch/index.ts` — tam `customMessage` już działa poprawnie (linia 252: `Admin context to weave in: ${customMessage}`).
- Szablon `admin-notification.tsx` — działa OK, `message` renderuje się akapitami.
- Brak nowych migracji, brak nowych edge functions, brak nowych tabel.

## Pliki do edycji

- `supabase/functions/generate-email/index.ts` (główny fix — rozszerzenie typów + twarda instrukcja kontekstu)
- `src/components/admin/AdminEmailDashboard.tsx` (bezpiecznik w `sendEmail` + label)

Po wdrożeniu funkcja edge zostanie automatycznie zredeployowana.

