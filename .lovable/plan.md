

# Dystrybucja blogu — wersja "zero kombinowania"

Skoro Telegram bot wymagałby zakładania konta @BotFather + podawania tokena, **wywalamy go** z Fazy 1. Zostawiamy tylko to, co działa **natychmiast, bez żadnej konfiguracji, bez API keys, bez approvali**.

## Co dostaniesz (1 klik = gotowe do wklejenia)

W panelu admina, przy każdym poście blogowym, pojawi się sekcja **„Dystrybucja"** z 4 przyciskami:

| Platforma | Co robi przycisk | Co musisz zrobić |
|---|---|---|
| **X / Twitter** | Kopiuje teaser + otwiera `twitter.com/intent/tweet` z wklejonym tekstem i linkiem | Klik „Tweetnij" |
| **Facebook** | Kopiuje teaser + otwiera `facebook.com/sharer` z linkiem | Klik „Opublikuj" |
| **TikTok (rolka)** | Generuje MP4 (9:16, 30s, hook AI + okładka + audio) w istniejącym TikTok Reels Studio i pobiera plik | Wrzucasz MP4 w aplikacji TikTok (drag & drop) |
| **Newsletter** | Wysyła post jako mail do wszystkich subskrybentów przez `mass-email-dispatch` (już naprawione) | Klik „Wyślij" |

Plus **„Skopiuj wszystko"** — jeden buffer z gotowymi teaserami pod każdą platformę osobno (X 280 zn., FB długi, TikTok caption + hashtagi).

## Co generuje AI (Lovable AI Gateway, `google/gemini-2.5-flash`)

Dla każdego posta blogowego, jednym callem, w 4 wariantach:
- **Hook X** — max 270 zn., 1 emoji, 2 hashtagi, link
- **Post FB** — 3 akapity, CTA „czytaj więcej", link
- **TikTok caption** — hook w 1. linijce + 5 hashtagów (#fyp #musicapp #aimusic #grouaistream + tematyczny)
- **Newsletter subject + preview** — pod istniejący szablon React Email

Wynik cache'owany w nowej kolumnie `blog_posts.distribution_payload` (jsonb), żeby nie regenerować przy każdym otwarciu.

## Co budujemy

### 1. Edge function `generate-blog-distribution`
- Input: `post_id`
- Czyta tytuł + treść posta
- Woła Lovable AI → zwraca JSON `{ x, facebook, tiktok, newsletter }`
- Zapisuje do `blog_posts.distribution_payload`
- Zwraca payload do frontu

### 2. Migracja DB
- `ALTER TABLE blog_posts ADD COLUMN distribution_payload jsonb`

### 3. Komponent `<BlogDistributionPanel postId={...} />`
Renderowany w `AdminBlogEditor` (lub gdziekolwiek edytujesz post). Cztery karty:
- **X** → `Copy` + `Open intent URL`
- **Facebook** → `Copy` + `Open sharer URL`
- **TikTok** → `Generate MP4` (woła istniejące `tiktok-reels-render` z auto-promptem z teasera) + `Download`
- **Newsletter** → `Send to all subscribers` (woła naprawione `mass-email-dispatch` z trybem `direct/all_users`, treść z `newsletter` payloadu)

Każda karta ma podgląd tekstu (edytowalny textarea — możesz poprawić przed wysłaniem) i licznik znaków dla X.

### 4. Integracja z istniejącym TikTok Reels Studio
- Przycisk „Generate MP4" przekazuje do studia: `{ caption, hook, coverImage: post.cover_url, durationSec: 30 }`
- Studio renderuje jak teraz, zwraca URL do MP4, panel pokazuje przycisk „Pobierz"

## Czego NIE robimy (świadomie)

- ❌ Telegram (wymaga bota)
- ❌ Auto-post na X (wymaga $100/mies API)
- ❌ Auto-post na FB (wymaga Meta App review)
- ❌ Auto-upload na TikTok (wymaga 2-8 tyg approval Content Posting API)
- ❌ Żadnych nowych connectorów, żadnych nowych secretów

## Efekt

Otwierasz post → klikasz **„Wygeneruj dystrybucję"** (10s czeka na AI) → masz 4 gotowe karty.
- **Newsletter**: 1 klik, leci do wszystkich (działa od razu).
- **TikTok**: 1 klik = MP4 do pobrania, wrzucasz w aplikacji telefonu.
- **X / FB**: 1 klik = otwarte okno publikacji z wklejonym tekstem, klikasz „Tweet" / „Post".

Cały flow: **~30 sekund** od „chcę rozpropagować post" do „leci na 4 kanały".

