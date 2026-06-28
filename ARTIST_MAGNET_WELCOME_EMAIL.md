# 🧲 Artist Magnet — mail powitalny (welcome-flow)

Ten mail leci automatycznie, gdy artysta zostawi maila w komponencie `ArtistMagnet`
(`source = "artist_magnet"`). Wyzwalany przez istniejący flow n8n
(`notifyN8nNewSubscriber` → `newsletter.subscribed`).

**Zasada:** wysyłamy TYLKO do osób, które same się zapisały (opt-in). Każdy mail ma
link do wypisu. Dzięki temu domena `grouaistream.com` zostaje czysta i maile dochodzą.

---

## Wersja PL

**Temat:** 🎧 Twój pierwszy krok na Spotify — od GrouAI

**Treść:**

Cześć!

Dzięki, że zostawiłeś/aś maila. Skoro tworzysz muzykę — jesteś dokładnie tam, gdzie trzeba.

GrouAI Stream pomaga artystom w trzech rzeczach:

🎵 **Puścić Twoją muzykę w obieg** — trafia do słuchaczy, radia i playlist, zamiast leżeć na dysku.

💸 **Zacząć na niej zarabiać** — realne wypłaty za odsłuchania, bez czekania latami na "odkrycie".

🚀 **Skrócić drogę na Spotify** — pokazujemy krok po kroku, jak zbudować zasięg, który Spotify nagradza.

**Twój pierwszy krok (2 minuty):**
👉 [Załóż konto artysty na grouaistream.com](https://grouaistream.com)

Po założeniu konta od razu zobaczysz, jak dodać swój pierwszy utwór.

Masz pytania? Po prostu odpisz na tego maila — czytamy każdą wiadomość.

Do usłyszenia,
Zespół GrouAI Stream

---
*Dostajesz tego maila, bo zapisałeś/aś się na grouaistream.com. [Wypisz się jednym kliknięciem](%UNSUBSCRIBE_URL%).*

---

## Wersja EN

**Subject:** 🎧 Your first step onto Spotify — from GrouAI

**Body:**

Hi!

Thanks for leaving your email. If you make music, you're in exactly the right place.

GrouAI Stream helps artists do three things:

🎵 **Get your music heard** — it reaches listeners, radio and playlists instead of sitting on a hard drive.

💸 **Start earning from it** — real payouts for streams, no waiting years to be "discovered".

🚀 **Reach Spotify faster** — we show you, step by step, how to build the traction Spotify rewards.

**Your first step (2 minutes):**
👉 [Create your artist account at grouaistream.com](https://grouaistream.com)

Once you're in, you'll see right away how to upload your first track.

Questions? Just reply to this email — we read every message.

Talk soon,
The GrouAI Stream team

---
*You're receiving this because you signed up at grouaistream.com. [Unsubscribe in one click](%UNSUBSCRIBE_URL%).*

---

## Jak to podpiąć (dla n8n)

1. W n8n złap event `newsletter.subscribed` z polem `source = "artist_magnet"`.
2. Rozgałęź: jeśli `source === "artist_magnet"` → wyślij TEN mail (artystyczny pitch).
   W innym wypadku → dotychczasowy newsletter bloga.
3. `%UNSUBSCRIBE_URL%` podmień na link z istniejącej funkcji `handle-email-unsubscribe`.
4. (Opcjonalnie) Dzień +3: przypomnienie "dodałeś już pierwszy utwór?" do tych, co nie założyli konta.
