

# 🟡 Postaw paywall — twardy FeatureGate na Studio / AI DJ / Mood

## Stan dziś (prawda z kodu)

| Feature | Plan w kontrakcie | Co dziś faktycznie blokuje |
|---|---|---|
| **GrouAI Studio** (`/suno`) | Ultimate | Gate `if (user && !isUltimate)` — **niezalogowany** widzi cały panel, free user widzi gate, ale po kliknięciu „Generuj" jest tylko soft-paywall przez `freeUsed` count |
| **AI DJ Section** (Index, „live-radio"/„ai-dj") | Pro (`canUseAIDJ`) | `<FeatureGate requiredPlan="pro">` — ✅ działa, ale **„QR Parkiet" + PartyActivationModal renderowane POZA bramką** (komentarz w kodzie: „always interactive") |
| **Mood detector** w PlayerBar (kamera, „Rozpoznawanie nastroju") | Pro (`canUseMoodDetection`) | ❌ **Zero gate** — każdy klika `setShowMoodDetector(true)`, otwiera się pełny `QuickMoodDetector` |
| **RadioMoodDetector** na `/radio-live` | Pro (`canUseMoodDetection`) | ❌ **Zero gate** |
| **AI Psychologist** (`/mood-history`) | Ultimate | ✅ `<FeatureGate requiredPlan="ultimate" mode="hide">` |
| **MoodDetector wewnątrz AIDJSection** | Pro | ✅ pokryty przez nadrzędny FeatureGate |

## Co zrobię

### 1. Studio (`/suno`) — twardy Ultimate gate dla wszystkich
- Zmienię warunek z `if (user && !isUltimate)` na `if (!isUltimate)` — niezalogowany dostaje **ten sam ekran upgrade** (z CTA „Zaloguj się i odblokuj Ultimate" jeśli `!user`, inaczej istniejące CTA `showUpgradeFor("GrouAI Studio")`)
- Usunę resztkowy soft-paywall `freeUsed/showPaywall` — staje się martwym kodem skoro free nie może już wejść do panelu (zostawiam tylko jeśli jest też używany dla soft-trial — sprawdzę i usunę nieużywane stany)
- **Efekt**: `/suno` to pełny Ultimate-only screen, zero ścieżki przez backend dla free

### 2. PlayerBar mood button → Pro paywall
- Owinę `<motion.button onClick={setShowMoodDetector(true)}>` w wrapper sprawdzający `canUseMoodDetection`:
  - jeśli **Pro** → otwiera `QuickMoodDetector` jak teraz
  - jeśli **Free** → zamiast otwierać kamerę, wywołuje `showUpgradeFor("Rozpoznawanie nastroju")` → pojawia się `UpgradeModal` (już zhakowany w `TopBar`/innych miejscach)
- Dodatkowo nakładam mały kłódka-overlay na ikonę dla free userów (ikonka `Lock` w prawym dolnym rogu mikro-przycisku) — wizualny sygnał Pro
- `<QuickMoodDetector isOpen={...}>` zostaje, ale `isOpen` może stać się `true` tylko przy `canUseMoodDetection`

### 3. RadioMoodDetector na `/radio-live` → Pro paywall
- W `src/pages/RadioLive.tsx` owinę `<RadioMoodDetector />` w `<FeatureGate requiredPlan="pro" featureName="Radio Mood Detection" mode="overlay">`
- Free user widzi blur + lockscreen z CTA „Upgrade do Pro"

### 4. AI DJ Section — uszczelnienie wycieku „QR Parkiet"
- Obecny komentarz: *„QR Parkiet button OUTSIDE FeatureGate so it's always clickable"* — to **wyciek**: free user może odpalić sesję imprezową
- Przenoszę przycisk **QR Parkiet + `PartyActivationModal` + `DJSessionQR`** **DO ŚRODKA** `<FeatureGate requiredPlan="pro">`
- Albo (bezpieczniej) zostawiam przycisk poza, ale jego `onClick` zmieniam na `canUseAIDJ ? setShowActivationModal(true) : showUpgradeFor("AI DJ Party")`
- **Wybieram opcję B** (przycisk widoczny dla free, ale klik = upgrade modal — lepsza konwersja, ten sam efekt blokady)

### 5. Spójność: wykorzystanie istniejącego `showUpgradeFor` + `UpgradeModal`
- Wszędzie gdzie blokuję klik (PlayerBar mood, AI DJ Party button), używam `useSubscription().showUpgradeFor(featureName)` — **ALE** sprawdzę czy `upgradePromptFeature` ma globalny listener który otwiera `UpgradeModal`
- Jeśli nie ma globalnego listenera (a w `TopBar` widzę lokalny `showUpgrade` state), dodam go w `MainLayout` jako **jedno globalne miejsce**: gdy `upgradePromptFeature !== null` → render `<UpgradeModal open={true} onOpenChange={() => dismissUpgradePrompt()} />`. Dzięki temu każdy `showUpgradeFor` z dowolnego miejsca otwiera modal.

## Wynik dla użytkownika

| Akcja free usera | Dziś | Po zmianach |
|---|---|---|
| Wejście na `/suno` | Widzi panel generowania (bug) | Pełny gate Ultimate z CTA |
| Klik 😊 mood w PlayerBar | Otwiera kamerę | Otwiera `UpgradeModal` (Pro) |
| Klik „Wykryj nastrój" w AI DJ | Pokryty | Pokryty (bez zmian) |
| Wejście na `/radio-live` → mood | Otwiera kamerę | Blur + „Upgrade do Pro" |
| Klik „QR Parkiet" | Otwiera modal sesji | Otwiera `UpgradeModal` |
| Wejście na `/mood-history` raport | Pokryty | Pokryty (bez zmian) |

## Szczegóły techniczne

- **Edycja**: `src/pages/Suno.tsx` — warunek gate, usunięcie martwych stanów `freeUsed`/`showPaywall` (jeśli nie używane gdzie indziej)
- **Edycja**: `src/components/layout/PlayerBar.tsx` — wrap mood button, dodanie kłódki, integracja `useSubscription`
- **Edycja**: `src/pages/RadioLive.tsx` — owinięcie `<RadioMoodDetector />` w `<FeatureGate>`
- **Edycja**: `src/components/sections/AIDJSection.tsx` — gate na klik „QR Parkiet" (opcja B — soft block przez upgrade modal)
- **Edycja**: `src/components/layout/MainLayout.tsx` — globalny listener `upgradePromptFeature` → renderuje `<UpgradeModal>` (jedno miejsce dla całej apki)
- **Bez nowych migracji, bez nowych edge functions, bez nowych komponentów** — używam istniejących `FeatureGate`, `UpgradeModal`, `useSubscription`

