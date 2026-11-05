import { useState, useEffect, useRef, forwardRef } from "react";
import { useFloatingHearts, FloatingHeartsOverlay } from "@/components/effects/FloatingHearts";
import { RatingLikeModal } from "@/components/modals/RatingLikeModal";
import { usePlayerOptional } from "@/contexts/PlayerContext";
import { CoffeeDialog } from "@/components/payments/CoffeeDialog";
import { 
  MoreHorizontal,
  Heart,
  Share2,
  Copy,
  Download,
  ListPlus,
  ExternalLink,
  Twitter,
  MessageCircle,
  Trash2,
  Coffee,
  DownloadCloud,
  Check,
  Gift,
  Headphones,
  ImagePlus,
  Film,
  QrCode,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShareQR } from "@/components/share/ShareQR";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isOffline, saveOfflineTrack, removeOfflineTrack } from "@/lib/offlineLibrary";
import { CoverStudioModal } from "@/components/modals/CoverStudioModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadTrackFile, trackGiftUrl, trackShareUrl } from "@/lib/trackFile";



interface TrackOptionsMenuProps {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackUrl?: string | null;
  className?: string;
  showLikeCount?: boolean;
  size?: "sm" | "md" | "lg";
  onLikeChange?: (liked: boolean) => void;
  onDelete?: () => void;
  showDelete?: boolean;
  playlistId?: string;
}

// Teksty menu w 4 językach (wybór użytkownika z LanguageContext).
const TXT = {
  pl: {
    like: "Daj ❤️", unlike: "Usuń ❤️", signIn: "Zaloguj się", liked: "Dodano do ulubionych ❤️", unliked: "Usunięto z ulubionych",
    fail: "Nie udało się — spróbuj ponownie", addPl: "Dodaj do playlisty", newPl: "+ Nowa playlista", loading: "Ładowanie…",
    noPl: "Brak playlist — utwórz nową powyżej", plName: "Nazwa nowej playlisty:", inPl: "Ten utwór już jest w", added: "Dodano do",
    created: "Utworzono playlistę i dodano utwór 🎶", photo: "Wgraj zdjęcie 📷", uploading: "Wgrywam…", aiCover: "AI okładka ⚡", painting: "Maluję…",
    aiClip: "AI teledysk 🎬 (max)", shooting: "Kręcę teledysk…", studio: "Cover Studio 🎨🎬", coffee: "Postaw kawę twórcy ☕",
    stems: "Rozdziel na ścieżki 🎚️", gift: "Wyślij prezent 🎁", sendTo: "Wyślij do", x: "Udostępnij na X", qr: "Kod QR / NFC",
    copy: "Kopiuj link", copied: "Link skopiowany ✅", copyFail: "Nie udało się skopiować", download: "Pobierz utwór", downloading: "Pobieram…",
    dlConsent: "Pobierasz utwór do użytku osobistego. Kontynuować?", dlStarted: "⬇️ Pobieranie rozpoczęte", dlTab: "Plik otwarty w nowej karcie — zapisz go stamtąd",
    noFile: "Ten utwór nie ma pliku", offline: "Pobierz offline", offlineOn: "Dostępne offline", offlineRm: "usuń", saving: "Zapisuję…",
    offlineSaved: "✅ Dostępne offline — zagra bez internetu", offlineRemoved: "Usunięto z trybu offline", offlineFail: "Nie udało się zapisać offline",
    openFile: "Otwórz plik", rmPl: "Usuń z playlisty", rmPlDone: "Usunięto z playlisty", del: "Usuń utwór", delMine: "Usuń z mojej biblioteki",
    delConfirm: "Usunąć utwór na stałe? Zniknie dla wszystkich słuchaczy.", delMineConfirm: "Usunąć z Twoich ulubionych, historii i playlist?",
    deleted: "Utwór usunięty", removedMine: "Usunięto z Twojej biblioteki", onlyOwner: "Tylko autor utworu może to zmienić",
    coverWrong: "To nie jest grafika — wybierz JPG, PNG lub WebP", coverBig: "Okładka może ważyć maksymalnie 5 MB", coverTry: "🎨 Przymierzam nową okładkę…",
    coverDone: "✨ Nowa okładka gotowa", aiCoverStart: "🎨 Maluję okładkę AI…", aiClipStart: "🎬 Kręcę teledysk AI (może potrwać kilka minut)…", clipDone: "🎬 Teledysk AI gotowy!",
    clipPaid: "Teledysk AI to płatna generacja (Replicate, kilka zł za klip). Kontynuować?", giftText: "🎁 Mam dla Ciebie prezent", giftCopied: "Link do prezentu skopiowany — wklej go, komu chcesz 🎁", listen: "Posłuchaj",
  },
  en: {
    like: "Like ❤️", unlike: "Unlike", signIn: "Sign in first", liked: "Added to Liked Songs ❤️", unliked: "Removed from Liked Songs",
    fail: "Something went wrong — try again", addPl: "Add to playlist", newPl: "+ New playlist", loading: "Loading…",
    noPl: "No playlists — create one above", plName: "New playlist name:", inPl: "Already in", added: "Added to",
    created: "Playlist created and track added 🎶", photo: "Upload photo 📷", uploading: "Uploading…", aiCover: "AI cover ⚡", painting: "Painting…",
    aiClip: "AI music video 🎬 (max)", shooting: "Shooting video…", studio: "Cover Studio 🎨🎬", coffee: "Buy the artist a coffee ☕",
    stems: "Split into stems 🎚️", gift: "Send as a gift 🎁", sendTo: "Send to", x: "Share on X", qr: "QR code / NFC",
    copy: "Copy link", copied: "Link copied ✅", copyFail: "Couldn't copy", download: "Download track", downloading: "Downloading…",
    dlConsent: "You are downloading this track for personal use. Continue?", dlStarted: "⬇️ Download started", dlTab: "File opened in a new tab — save it from there",
    noFile: "This track has no file", offline: "Save offline", offlineOn: "Available offline", offlineRm: "remove", saving: "Saving…",
    offlineSaved: "✅ Available offline — plays without internet", offlineRemoved: "Removed from offline", offlineFail: "Couldn't save offline",
    openFile: "Open file", rmPl: "Remove from playlist", rmPlDone: "Removed from playlist", del: "Delete track", delMine: "Remove from my library",
    delConfirm: "Delete this track permanently? It disappears for all listeners.", delMineConfirm: "Remove from your likes, history and playlists?",
    deleted: "Track deleted", removedMine: "Removed from your library", onlyOwner: "Only the track's author can change this",
    coverWrong: "Not an image — choose JPG, PNG or WebP", coverBig: "Cover can be at most 5 MB", coverTry: "🎨 Trying on the new cover…",
    coverDone: "✨ New cover ready", aiCoverStart: "🎨 Painting an AI cover…", aiClipStart: "🎬 Shooting an AI video (may take a few minutes)…", clipDone: "🎬 AI video ready!",
    clipPaid: "The AI music video is a paid generation (Replicate, about $1 per clip). Continue?", giftText: "🎁 I have a gift for you", giftCopied: "Gift link copied — paste it to anyone 🎁", listen: "Listen",
  },
  nl: {
    like: "Vind ik leuk ❤️", unlike: "Niet meer leuk", signIn: "Log eerst in", liked: "Toegevoegd aan favorieten ❤️", unliked: "Verwijderd uit favorieten",
    fail: "Mislukt — probeer opnieuw", addPl: "Aan playlist toevoegen", newPl: "+ Nieuwe playlist", loading: "Laden…",
    noPl: "Geen playlists — maak er hierboven een", plName: "Naam nieuwe playlist:", inPl: "Staat al in", added: "Toegevoegd aan",
    created: "Playlist gemaakt en nummer toegevoegd 🎶", photo: "Foto uploaden 📷", uploading: "Uploaden…", aiCover: "AI-cover ⚡", painting: "Schilderen…",
    aiClip: "AI-videoclip 🎬 (max)", shooting: "Clip maken…", studio: "Cover Studio 🎨🎬", coffee: "Trakteer de artiest op koffie ☕",
    stems: "Splitsen in sporen 🎚️", gift: "Als cadeau sturen 🎁", sendTo: "Sturen naar", x: "Delen op X", qr: "QR-code / NFC",
    copy: "Link kopiëren", copied: "Link gekopieerd ✅", copyFail: "Kopiëren mislukt", download: "Nummer downloaden", downloading: "Downloaden…",
    dlConsent: "Je downloadt dit nummer voor persoonlijk gebruik. Doorgaan?", dlStarted: "⬇️ Download gestart", dlTab: "Bestand geopend in nieuw tabblad — sla het daar op",
    noFile: "Dit nummer heeft geen bestand", offline: "Offline opslaan", offlineOn: "Offline beschikbaar", offlineRm: "verwijder", saving: "Opslaan…",
    offlineSaved: "✅ Offline beschikbaar — speelt zonder internet", offlineRemoved: "Uit offline verwijderd", offlineFail: "Offline opslaan mislukt",
    openFile: "Bestand openen", rmPl: "Uit playlist verwijderen", rmPlDone: "Uit playlist verwijderd", del: "Nummer verwijderen", delMine: "Uit mijn bibliotheek",
    delConfirm: "Nummer definitief verwijderen? Het verdwijnt voor alle luisteraars.", delMineConfirm: "Verwijderen uit je favorieten, geschiedenis en playlists?",
    deleted: "Nummer verwijderd", removedMine: "Uit je bibliotheek verwijderd", onlyOwner: "Alleen de maker kan dit wijzigen",
    coverWrong: "Geen afbeelding — kies JPG, PNG of WebP", coverBig: "Cover mag maximaal 5 MB zijn", coverTry: "🎨 Nieuwe cover passen…",
    coverDone: "✨ Nieuwe cover klaar", aiCoverStart: "🎨 AI-cover schilderen…", aiClipStart: "🎬 AI-clip maken (kan enkele minuten duren)…", clipDone: "🎬 AI-clip klaar!",
    clipPaid: "De AI-videoclip is een betaalde generatie (Replicate, ca. €1 per clip). Doorgaan?", giftText: "🎁 Ik heb een cadeau voor je", giftCopied: "Cadeaulink gekopieerd — plak hem waar je wilt 🎁", listen: "Luister",
  },
  ua: {
    like: "Подобається ❤️", unlike: "Прибрати ❤️", signIn: "Спершу увійдіть", liked: "Додано до улюблених ❤️", unliked: "Прибрано з улюблених",
    fail: "Не вдалося — спробуйте ще", addPl: "Додати до плейлиста", newPl: "+ Новий плейлист", loading: "Завантаження…",
    noPl: "Немає плейлистів — створіть вище", plName: "Назва нового плейлиста:", inPl: "Вже є в", added: "Додано до",
    created: "Плейлист створено, трек додано 🎶", photo: "Завантажити фото 📷", uploading: "Завантажую…", aiCover: "AI-обкладинка ⚡", painting: "Малюю…",
    aiClip: "AI-кліп 🎬 (max)", shooting: "Знімаю кліп…", studio: "Cover Studio 🎨🎬", coffee: "Пригостити автора кавою ☕",
    stems: "Розділити на доріжки 🎚️", gift: "Надіслати подарунок 🎁", sendTo: "Надіслати в", x: "Поділитися в X", qr: "QR-код / NFC",
    copy: "Копіювати посилання", copied: "Посилання скопійовано ✅", copyFail: "Не вдалося скопіювати", download: "Завантажити трек", downloading: "Завантажую…",
    dlConsent: "Ви завантажуєте трек для особистого використання. Продовжити?", dlStarted: "⬇️ Завантаження почалося", dlTab: "Файл відкрито в новій вкладці — збережіть його звідти",
    noFile: "У треку немає файлу", offline: "Зберегти офлайн", offlineOn: "Доступно офлайн", offlineRm: "прибрати", saving: "Зберігаю…",
    offlineSaved: "✅ Доступно офлайн — грає без інтернету", offlineRemoved: "Прибрано з офлайну", offlineFail: "Не вдалося зберегти офлайн",
    openFile: "Відкрити файл", rmPl: "Прибрати з плейлиста", rmPlDone: "Прибрано з плейлиста", del: "Видалити трек", delMine: "Прибрати з моєї бібліотеки",
    delConfirm: "Видалити трек назавжди? Він зникне для всіх слухачів.", delMineConfirm: "Прибрати з улюблених, історії та плейлистів?",
    deleted: "Трек видалено", removedMine: "Прибрано з вашої бібліотеки", onlyOwner: "Змінити може лише автор треку",
    coverWrong: "Це не зображення — оберіть JPG, PNG або WebP", coverBig: "Обкладинка — максимум 5 МБ", coverTry: "🎨 Приміряю нову обкладинку…",
    coverDone: "✨ Нова обкладинка готова", aiCoverStart: "🎨 Малюю AI-обкладинку…", aiClipStart: "🎬 Знімаю AI-кліп (кілька хвилин)…", clipDone: "🎬 AI-кліп готовий!",
    clipPaid: "AI-кліп — платна генерація (Replicate, близько $1 за кліп). Продовжити?", giftText: "🎁 У мене для тебе подарунок", giftCopied: "Посилання на подарунок скопійовано 🎁", listen: "Слухай",
  },
} as const;

// Rola admina sprawdzana raz na sesję (a nie przy każdej karcie utworu).
const adminCache = new Map<string, Promise<boolean>>();
function isAdminUser(userId: string): Promise<boolean> {
  if (!adminCache.has(userId)) {
    adminCache.set(userId, Promise.resolve(supabase.rpc("has_role", { _user_id: userId, _role: "admin" }))
      .then(({ data }) => data === true).catch(() => false));
  }
  return adminCache.get(userId)!;
}

const TrackOptionsMenuComponent = (
  {
    trackId,
    trackTitle,
    trackArtist,
    trackUrl,
    className,
    showLikeCount = false,
    size = "md",
    onLikeChange,
    onDelete,
    showDelete = true,
    playlistId
  }: TrackOptionsMenuProps,
  ref: React.ForwardedRef<HTMLDivElement>
) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = TXT[(language as keyof typeof TXT)] ?? TXT.pl;
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCoffeeDialog, setShowCoffeeDialog] = useState(false);
  const [showCoverStudio, setShowCoverStudio] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [trackOwnerId, setTrackOwnerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<{ id: string; title: string }[]>([]);
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isOwner = !!user && !!trackOwnerId && trackOwnerId === user.id;
  const canEdit = isOwner || isAdmin;
  const shareUrl = trackShareUrl(trackId);
  const giftUrl = trackGiftUrl(trackId);
  const fileName = `${trackArtist} - ${trackTitle}`;

  // Dane menu (autor, serduszko, offline, admin) pobieramy dopiero przy otwarciu menu —
  // wcześniej każda karta utworu robiła 3–4 zapytania już przy wejściu na stronę.
  const loadMeta = async () => {
    const [{ data: tr }, liked, count, off, admin] = await Promise.all([
      supabase.from("tracks").select("user_id").eq("id", trackId).maybeSingle(),
      user?.id
        ? supabase.from("liked_songs").select("id").eq("user_id", user.id).eq("track_id", trackId).maybeSingle().then((r) => !!r.data)
        : Promise.resolve(false),
      showLikeCount
        ? supabase.from("liked_songs").select("*", { count: "exact", head: true }).eq("track_id", trackId).then((r) => r.count || 0)
        : Promise.resolve(0),
      isOffline(trackId).catch(() => false),
      user?.id ? isAdminUser(user.id) : Promise.resolve(false),
    ]);
    setTrackOwnerId(tr?.user_id ?? null);
    setIsLiked(liked);
    setLikeCount(count);
    setOfflineSaved(off);
    setIsAdmin(admin);
    setMetaLoaded(true);
  };
  const onOpenChange = (open: boolean) => { if (open) loadMeta().catch(() => setMetaLoaded(true)); };

  useEffect(() => { setMetaLoaded(false); }, [trackId, user?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId: string; liked: boolean };
      if (detail?.trackId === trackId) {
        setIsLiked(detail.liked);
        if (showLikeCount) setLikeCount((prev) => Math.max(0, prev + (detail.liked ? 1 : -1)));
      }
    };
    window.addEventListener("track-like-changed", handler);
    return () => window.removeEventListener("track-like-changed", handler);
  }, [trackId, showLikeCount]);

  const handleLike = async () => {
    if (!user) { toast.error(t.signIn); return; }
    setLoading(true);
    try {
      const next = !isLiked;
      const { error } = next
        ? await supabase.from("liked_songs").insert({ user_id: user.id, track_id: trackId })
        : await supabase.from("liked_songs").delete().eq("user_id", user.id).eq("track_id", trackId);
      if (error && !(next && error.code === "23505")) throw error; // 23505 = już polubiony
      setIsLiked(next);
      setLikeCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
      window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId, liked: next } }));
      toast.success(next ? t.liked : t.unliked);
      onLikeChange?.(next);
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error(t.fail);
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      // Starsze przeglądarki / brak uprawnień — ręczne kopiowanie.
      window.prompt(t.copy, text);
    }
  };
  const handleCopyLink = () => copyText(shareUrl, t.copied);

  const openExternal = (href: string) => {
    const a = document.createElement("a");
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); a.remove();
  };
  const handleShareTwitter = () =>
    openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎵 ${trackTitle} — ${trackArtist} | GrouAI Stream`)}&url=${encodeURIComponent(shareUrl)}`);
  const handleShareWhatsApp = () =>
    openExternal(`https://api.whatsapp.com/send?text=${encodeURIComponent(`🎵 ${t.listen}: „${trackTitle}” — ${trackArtist} ${shareUrl}`)}`);

  // Prezent 🎁 — strona /prezent/:id (paczka → otwarcie → piosenka z okładką).
  const handleSendGift = async () => {
    const text = `${t.giftText} — „${trackTitle}” (${trackArtist})`;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: "🎁 GrouAI Stream", text, url: giftUrl }); return; }
      catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    await copyText(`${text} ${giftUrl}`, t.giftCopied);
  };

  const handleOffline = async () => {
    if (offlineSaved) {
      await removeOfflineTrack(trackId);
      setOfflineSaved(false);
      toast.success(t.offlineRemoved);
      return;
    }
    if (!trackUrl) { toast.error(t.noFile); return; }
    setSavingOffline(true);
    try {
      await saveOfflineTrack(trackId, trackUrl, { title: trackTitle, artist: trackArtist });
      setOfflineSaved(true);
      toast.success(t.offlineSaved);
    } catch (e) {
      console.error("Offline save failed:", e);
      toast.error(t.offlineFail);
    } finally {
      setSavingOffline(false);
    }
  };

  const handleDownload = async () => {
    if (!trackUrl) { toast.error(t.noFile); return; }
    if (!window.confirm(t.dlConsent)) return;
    setDownloading(true);
    try {
      const saved = await downloadTrackFile(trackUrl, fileName);
      toast.success(saved ? t.dlStarted : t.dlTab);
    } finally {
      setDownloading(false);
    }
  };

  // Playlisty użytkownika — leniwie, dopiero gdy otwiera podmenu.
  const loadMyPlaylists = async () => {
    if (playlistsLoaded || !user) return;
    const { data } = await supabase
      .from("playlists")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyPlaylists(data ?? []);
    setPlaylistsLoaded(true);
  };

  const handleAddToPlaylist = async (targetPlaylistId: string, targetTitle: string) => {
    if (!user) { toast.error(t.signIn); return; }
    setAddingTo(targetPlaylistId);
    try {
      const { data: existing } = await supabase
        .from("playlist_tracks").select("id")
        .eq("playlist_id", targetPlaylistId).eq("track_id", trackId).maybeSingle();
      if (existing) { toast.info(`${t.inPl} „${targetTitle}”`); return; }
      const { data: last } = await supabase
        .from("playlist_tracks").select("position")
        .eq("playlist_id", targetPlaylistId)
        .order("position", { ascending: false }).limit(1).maybeSingle();
      const { error } = await supabase
        .from("playlist_tracks")
        .insert({ playlist_id: targetPlaylistId, track_id: trackId, position: (last?.position ?? -1) + 1 });
      if (error) throw error;
      toast.success(`${t.added} „${targetTitle}” 🎶`);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (e) {
      console.error("Add to playlist failed:", e);
      toast.error(t.fail);
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreatePlaylistAndAdd = async () => {
    if (!user) { toast.error(t.signIn); return; }
    const name = window.prompt(t.plName, trackTitle);
    if (!name || !name.trim()) return;
    setAddingTo("__new__");
    try {
      const { data: created, error: createErr } = await supabase
        .from("playlists").insert({ title: name.trim(), user_id: user.id }).select("id, title").single();
      if (createErr || !created) throw createErr;
      const { error: addErr } = await supabase
        .from("playlist_tracks").insert({ playlist_id: created.id, track_id: trackId, position: 0 });
      if (addErr) throw addErr;
      setMyPlaylists((prev) => [{ id: created.id, title: created.title }, ...prev]);
      toast.success(t.created);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (e) {
      console.error("Create playlist failed:", e);
      toast.error(t.fail);
    } finally {
      setAddingTo(null);
    }
  };

  /** Zapis pola utworu z kontrolą RLS (0 zmienionych wierszy = brak uprawnień, a nie „sukces”). */
  const updateTrack = async (patch: Record<string, string>) => {
    const { data, error } = await supabase.from("tracks").update(patch).eq("id", trackId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error(t.onlyOwner);
  };

  // Nowa okładka 🎨 — plik do publicznego bucketa "music" (covers/...), tracks.cover_url dostaje nowy adres.
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const handleCoverPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error(t.coverWrong); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t.coverBig); return; }
    setCoverUploading(true);
    toast.info(t.coverTry);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `covers/${trackId}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("music").upload(path, file, { contentType: file.type, upsert: true });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("music").getPublicUrl(path);
      await updateTrack({ cover_url: pub.publicUrl });
      toast.success(t.coverDone);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      console.error("Cover update failed:", err);
      toast.error(err instanceof Error && err.message ? err.message : t.fail);
    } finally {
      setCoverUploading(false);
    }
  };

  // Szybka okładka AI — bez otwierania Cover Studio.
  const [aiCoverBusy, setAiCoverBusy] = useState(false);
  const handleQuickAICover = async () => {
    if (aiCoverBusy) return;
    setAiCoverBusy(true);
    toast.info(t.aiCoverStart);
    try {
      const { data, error } = await supabase.functions.invoke("ai-cover-generate", {
        body: { title: trackTitle, style: "", description: `${trackTitle} — ${trackArtist}`, mode: "auto" },
      });
      if (error) throw error;
      const coverUrl = data?.cover_url;
      if (!coverUrl) throw new Error(data?.error || t.fail);
      await updateTrack({ cover_url: coverUrl });
      toast.success(t.coverDone);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      console.error("Quick AI cover failed:", err);
      toast.error(err instanceof Error && err.message ? err.message : t.fail);
    } finally {
      setAiCoverBusy(false);
    }
  };

  // Szybki teledysk AI (max jakość) — aktualna okładka jako klatka startowa.
  const [aiClipBusy, setAiClipBusy] = useState(false);
  const handleQuickAIClip = async () => {
    if (aiClipBusy) return;
    if (!window.confirm(t.clipPaid)) return; // płatna generacja (Replicate) — tylko świadomie
    setAiClipBusy(true);
    toast.info(t.aiClipStart, { duration: 8000 });
    try {
      const { data: trackRow } = await supabase.from("tracks").select("cover_url").eq("id", trackId).maybeSingle();
      const { data, error } = await supabase.functions.invoke("cover-video-generate", {
        body: {
          prompt: `Music video for "${trackTitle}" by ${trackArtist} — cinematic, atmospheric, dynamic camera movement, professional color grading`,
          image_url: trackRow?.cover_url || null,
          quality: "max",
        },
      });
      if (error) throw error;
      const videoUrl = data?.video_url;
      if (!videoUrl) throw new Error(data?.error || t.fail);
      await updateTrack({ video_url: videoUrl });
      toast.success(t.clipDone);
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      console.error("Quick AI clip failed:", err);
      toast.error(err instanceof Error && err.message ? err.message : t.fail);
    } finally {
      setAiClipBusy(false);
    }
  };

  const handleRemoveFromPlaylist = async () => {
    if (!user || !playlistId) return;
    setDeleteLoading(true);
    const { data: removedRows, error } = await supabase
      .from("playlist_tracks").delete()
      .eq("playlist_id", playlistId).eq("track_id", trackId).select("id");
    if (error || !removedRows || removedRows.length === 0) {
      console.error("Error removing track:", error);
      toast.error(error?.message || t.fail);
    } else {
      toast.success(t.rmPlDone);
      onDelete?.();
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    }
    setDeleteLoading(false);
  };

  // Autor/admin: usuwa utwór na stałe. Słuchacz: czyści tylko swoją bibliotekę (ulubione, historia, playlisty).
  const handleDeleteTrack = async () => {
    if (!user) { toast.error(t.signIn); return; }
    if (!window.confirm(canEdit ? t.delConfirm : t.delMineConfirm)) return;
    setDeleteLoading(true);
    try {
      await supabase.from("liked_songs").delete().eq("track_id", trackId).eq("user_id", user.id);
      await supabase.from("listening_history").delete().eq("track_id", trackId).eq("user_id", user.id);
      const { data: userPlaylists } = await supabase.from("playlists").select("id").eq("user_id", user.id);
      if (userPlaylists && userPlaylists.length > 0) {
        await supabase.from("playlist_tracks").delete().eq("track_id", trackId).in("playlist_id", userPlaylists.map((p) => p.id));
      }
      if (canEdit) {
        // `.select("id")` — bez niego DELETE nie odróżnia sukcesu od cichej odmowy RLS.
        const { data: deletedRows, error: delError } = await supabase.from("tracks").delete().eq("id", trackId).select("id");
        if (delError || !deletedRows || deletedRows.length === 0) throw new Error(delError?.message || t.onlyOwner);
      }
      toast.success(canEdit ? t.deleted : t.removedMine);
      setIsLiked(false);
      onDelete?.();
      window.dispatchEvent(new CustomEvent("track-list-changed"));
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t.fail);
    } finally {
      setDeleteLoading(false);
    }
  };

  const iconSize = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" }[size];

  return (
    <div ref={ref}>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={trackTitle}
            className={cn(
              "p-1.5 rounded-full hover:bg-secondary/80 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              className
            )}
          >
            <MoreHorizontal className={cn(iconSize, "text-muted-foreground hover:text-foreground")} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 max-h-[80vh] overflow-y-auto">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none truncate">{trackTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{trackArtist}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleLike} disabled={loading} className="cursor-pointer">
            <Heart className={cn("mr-2 h-4 w-4", isLiked && "fill-primary text-primary")} />
            <span className="flex-1">{isLiked ? t.unlike : t.like}</span>
            {showLikeCount && likeCount > 0 && <span className="text-xs text-muted-foreground">{likeCount}</span>}
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger onPointerEnter={loadMyPlaylists} onClick={loadMyPlaylists} onFocus={loadMyPlaylists}>
              <ListPlus className="mr-2 h-4 w-4" />
              {t.addPl}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto w-56">
              <DropdownMenuItem
                onClick={handleCreatePlaylistAndAdd}
                disabled={addingTo === "__new__"}
                className="cursor-pointer text-primary focus:text-primary"
              >
                <ListPlus className="mr-2 h-4 w-4" />
                {t.newPl}
              </DropdownMenuItem>
              {myPlaylists.length > 0 && <DropdownMenuSeparator />}
              {!user ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{t.signIn}</div>
              ) : !playlistsLoaded ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{t.loading}</div>
              ) : myPlaylists.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{t.noPl}</div>
              ) : (
                myPlaylists.map((pl) => (
                  <DropdownMenuItem
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id, pl.title)}
                    disabled={addingTo === pl.id}
                    className="cursor-pointer"
                  >
                    <ListPlus className="mr-2 h-4 w-4 opacity-60" />
                    <span className="truncate">{pl.title}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Okładka i teledysk — tylko autor utworu (albo admin); innym i tak odmówiłaby baza. */}
          {canEdit && (
            <>
              <DropdownMenuItem
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="cursor-pointer text-sky-300 focus:text-sky-200 focus:bg-sky-500/10"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                <span className="flex-1">{coverUploading ? t.uploading : t.photo}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleQuickAICover}
                disabled={aiCoverBusy}
                className="cursor-pointer text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                <span className="flex-1">{aiCoverBusy ? t.painting : t.aiCover}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleQuickAIClip}
                disabled={aiClipBusy}
                className="cursor-pointer text-rose-300 focus:text-rose-200 focus:bg-rose-500/10"
              >
                <Film className="mr-2 h-4 w-4" />
                <span className="flex-1">{aiClipBusy ? t.shooting : t.aiClip}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowCoverStudio(true)}
                className="cursor-pointer text-fuchsia-300 focus:text-fuchsia-200 focus:bg-fuchsia-500/10"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                <span className="flex-1">{t.studio}</span>
              </DropdownMenuItem>
            </>
          )}

          {metaLoaded && trackOwnerId && !isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowCoffeeDialog(true)}
                className="cursor-pointer text-amber-400 focus:text-amber-300 focus:bg-amber-500/10"
              >
                <Coffee className="mr-2 h-4 w-4" />
                <span className="flex-1">{t.coffee}</span>
                <span className="text-[10px] text-muted-foreground">1$ / 3$ / 5$</span>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          {trackUrl && (
            <DropdownMenuItem
              onClick={() => window.dispatchEvent(new CustomEvent("grouai:open-stems", { detail: { audioUrl: trackUrl, title: trackTitle } }))}
              className="cursor-pointer text-cyan-300 focus:text-cyan-200 focus:bg-cyan-500/10"
            >
              <Headphones className="mr-2 h-4 w-4" />
              <span className="flex-1">{t.stems}</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={handleSendGift}
            className="cursor-pointer text-amber-300 focus:text-amber-200 focus:bg-amber-500/10"
          >
            <Gift className="mr-2 h-4 w-4" />
            <span className="flex-1">{t.gift}</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Share2 className="mr-2 h-4 w-4" />
              {t.sendTo}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={handleShareWhatsApp} className="cursor-pointer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShareTwitter} className="cursor-pointer">
                <Twitter className="mr-2 h-4 w-4" />
                {t.x}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowQR(true)} className="cursor-pointer">
                <QrCode className="mr-2 h-4 w-4" />
                {t.qr}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            {t.copy}
          </DropdownMenuItem>

          {trackUrl && (
            <DropdownMenuItem onClick={handleDownload} disabled={downloading} className="cursor-pointer">
              <Download className={cn("mr-2 h-4 w-4", downloading && "animate-bounce")} />
              {downloading ? t.downloading : t.download}
            </DropdownMenuItem>
          )}

          {trackUrl && (
            <DropdownMenuItem onClick={handleOffline} disabled={savingOffline} className="cursor-pointer">
              {offlineSaved ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <DownloadCloud className="mr-2 h-4 w-4" />}
              <span className="flex-1">{savingOffline ? t.saving : offlineSaved ? t.offlineOn : t.offline}</span>
              {offlineSaved && <span className="text-[10px] text-emerald-400">{t.offlineRm}</span>}
            </DropdownMenuItem>
          )}

          {trackUrl && (
            <DropdownMenuItem onClick={() => openExternal(trackUrl)} className="cursor-pointer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t.openFile}
            </DropdownMenuItem>
          )}

          {playlistId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleRemoveFromPlaylist}
                disabled={deleteLoading}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t.rmPl}
              </DropdownMenuItem>
            </>
          )}

          {showDelete && user && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDeleteTrack}
                disabled={deleteLoading || !metaLoaded}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {canEdit ? t.del : t.delMine}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleCoverPicked}
      />

      {showCoffeeDialog && (
        <CoffeeDialog
          open={showCoffeeDialog}
          onOpenChange={setShowCoffeeDialog}
          recipientUserId={trackOwnerId ?? undefined}
          recipientTrackId={trackId}
          recipientName={trackArtist}
        />
      )}

      {showCoverStudio && (
        <CoverStudioModal
          open={showCoverStudio}
          onOpenChange={setShowCoverStudio}
          trackId={trackId}
          trackTitle={trackTitle}
          trackArtist={trackArtist}
        />
      )}

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="truncate">{trackTitle}</DialogTitle>
          </DialogHeader>
          {showQR && <ShareQR url={shareUrl} title={`${trackTitle} — ${trackArtist}`} compact />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const TrackOptionsMenu = forwardRef<HTMLDivElement, TrackOptionsMenuProps>(TrackOptionsMenuComponent);
TrackOptionsMenu.displayName = "TrackOptionsMenu";

// Separate like button component for inline use
interface LikeButtonProps {
  trackId: string;
  className?: string;
  showCount?: boolean;
}

const LikeButtonComponent = (
  { trackId, className, showCount = false }: LikeButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) => {
  const { user } = useAuth();
  const player = usePlayerOptional();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [trackMeta, setTrackMeta] = useState<{ title: string; artist: string } | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const { hearts, spawnHearts } = useFloatingHearts();

  const fetchData = async () => {
    if (showCount) {
      const { count } = await supabase
        .from("liked_songs")
        .select("*", { count: "exact", head: true })
        .eq("track_id", trackId);
      setLikeCount(count || 0);
    }
    // Sprawdź właściciela utworu
    const { data: trackOwner } = await supabase
      .from("tracks")
      .select("user_id")
      .eq("id", trackId)
      .maybeSingle();
    if (user?.id && trackOwner?.user_id === user.id) {
      setIsOwn(true);
      setIsLiked(false);
      return;
    }
    setIsOwn(false);
    if (user?.id) {
      const { data } = await supabase
        .from("liked_songs")
        .select("id")
        .eq("user_id", user.id)
        .eq("track_id", trackId)
        .maybeSingle();
      setIsLiked(!!data);
    } else {
      setIsLiked(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Sync with player + other LikeButtons via global event
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { trackId: string; liked: boolean };
      if (detail?.trackId === trackId) {
        setIsLiked(detail.liked);
        if (showCount) {
          setLikeCount((prev) => Math.max(0, prev + (detail.liked ? 1 : -1)));
        }
      }
    };
    window.addEventListener("track-like-changed", handler);
    return () => window.removeEventListener("track-like-changed", handler);
  }, [trackId, user?.id, showCount]);

  const broadcast = (liked: boolean) => {
    window.dispatchEvent(new CustomEvent("track-like-changed", { detail: { trackId, liked } }));
  };

  const handleUnlike = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase
        .from("liked_songs")
        .delete()
        .eq("user_id", user.id)
        .eq("track_id", trackId);
      setIsLiked(false);
      setLikeCount((prev) => Math.max(0, prev - 1));
      broadcast(false);
      toast.success("Removed from Liked Songs");
    } catch {
      toast.error("Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Sign in to like songs");
      return;
    }
    if (isOwn) {
      toast.error("Nie możesz polubić własnego utworu 🎵");
      return;
    }

    if (isLiked) {
      handleUnlike();
      return;
    }

    // Nowe polubienie → wymaga oceny gwiazdkowej (jak w playerze)
    spawnHearts(e);
    // Pobierz tytuł/artystę utworu, jeśli nie znamy
    let meta = trackMeta;
    if (!meta) {
      const { data } = await supabase
        .from("tracks")
        .select("title, artist")
        .eq("id", trackId)
        .maybeSingle();
      meta = { title: data?.title || "Utwór", artist: data?.artist || "Artysta" };
      setTrackMeta(meta);
    }
    setShowRatingModal(true);
  };

  // Listened seconds — z playera jeśli to aktualny utwór, inaczej 30s (próg minimalny)
  const listenedSeconds =
    player?.currentTrack?.id === trackId ? player.currentTime : 30;

  return (
    <>
      <button
        ref={ref}
        onClick={handleLike}
        disabled={loading || isOwn}
        title={isOwn ? "To Twój utwór — nie możesz go polubić" : undefined}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-full transition-all",
          "hover:bg-secondary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          "active:scale-95",
          isOwn && "opacity-40 cursor-not-allowed",
          className
        )}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-all duration-200",
            isLiked 
              ? "fill-primary text-primary scale-110" 
              : "text-muted-foreground hover:text-foreground scale-100"
          )}
        />
        {showCount && likeCount > 0 && (
          <span className="text-xs text-muted-foreground">{likeCount}</span>
        )}
      </button>
      <FloatingHeartsOverlay hearts={hearts} />
      {trackMeta && (
        <RatingLikeModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          trackId={trackId}
          trackTitle={trackMeta.title}
          trackArtist={trackMeta.artist}
          listenedSeconds={listenedSeconds}
          onSuccess={() => {
            setIsLiked(true);
            setLikeCount((prev) => prev + 1);
            broadcast(true);
          }}
        />
      )}
    </>
  );
};

export const LikeButton = forwardRef<HTMLButtonElement, LikeButtonProps>(LikeButtonComponent);
LikeButton.displayName = "LikeButton";
