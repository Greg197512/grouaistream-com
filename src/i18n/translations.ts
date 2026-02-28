export type Language = "pl" | "en" | "nl" | "ua";

export const languageNames: Record<Language, string> = {
  pl: "Polski",
  en: "English",
  nl: "Nederlands",
  ua: "Українська",
};

export const languageFlags: Record<Language, string> = {
  pl: "🇵🇱",
  en: "🇬🇧",
  nl: "🇳🇱",
  ua: "🇺🇦",
};

type TranslationKeys = {
  // Navigation
  "nav.home": string;
  "nav.search": string;
  "nav.library": string;
  "nav.createPlaylist": string;
  "nav.likedSongs": string;
  "nav.managePlaylists": string;
  "nav.mediaServer": string;
  "nav.movies": string;
  "nav.radioLive": string;
  "nav.importYoutube": string;
  "nav.aiDj": string;
  "nav.moodDetection": string;
  "nav.moodHistory": string;
  "nav.realtimeAdaptation": string;
  "nav.adminPanel": string;
  "nav.settings": string;
  "nav.legalDocs": string;
  "nav.aiFeatures": string;

  // TopBar
  "topbar.searchPlaceholder": string;
  "topbar.signIn": string;
  "topbar.upgrade": string;
  "topbar.notifications": string;
  "topbar.aiDjReady": string;
  "topbar.aiDjReadyDesc": string;
  "topbar.newTracks": string;
  "topbar.newTracksDesc": string;
  "topbar.loggedIn": string;
  "topbar.profile": string;
  "topbar.yourLibrary": string;
  "topbar.likedSongs": string;
  "topbar.settings": string;
  "topbar.aiPreferences": string;
  "topbar.signOut": string;
  "topbar.myAccount": string;
  "topbar.createAccount": string;

  // Hero
  "hero.badge": string;
  "hero.title1": string;
  "hero.titleHighlight": string;
  "hero.title2": string;
  "hero.subtitle": string;
  "hero.startListening": string;
  "hero.liveRadio": string;
  "hero.moodDetection": string;
  "hero.realtimeAdaptation": string;
  "hero.aiPlaylists": string;
  "hero.nowPlaying": string;
  "hero.noTracks": string;
  "hero.failedLoad": string;
  "hero.enableMoodDetection": string;
  "hero.realtimeActive": string;

  // Settings
  "settings.title": string;
  "settings.profile": string;
  "settings.displayName": string;
  "settings.saveChanges": string;
  "settings.saving": string;
  "settings.profileUpdated": string;
  "settings.profileError": string;
  "settings.changeAvatar": string;
  "settings.avatarUpdated": string;
  "settings.avatarError": string;
  "settings.aiPrivacy": string;
  "settings.aiPrivacyDesc": string;
  "settings.moodDetection": string;
  "settings.moodDetectionDesc": string;
  "settings.webcamMood": string;
  "settings.webcamMoodDesc": string;
  "settings.voiceEmotion": string;
  "settings.voiceEmotionDesc": string;
  "settings.listeningHistory": string;
  "settings.listeningHistoryDesc": string;
  "settings.notifications": string;
  "settings.newReleases": string;
  "settings.newReleasesDesc": string;
  "settings.playlistUpdates": string;
  "settings.playlistUpdatesDesc": string;
  "settings.aiRecommendations": string;
  "settings.aiRecommendationsDesc": string;
  "settings.dataManagement": string;
  "settings.deleteHistory": string;
  "settings.deleteHistoryConfirm": string;
  "settings.deleteHistorySuccess": string;
  "settings.deleteHistoryError": string;
  "settings.gdprCompliant": string;
  "settings.legalCompliance": string;
  "settings.legalBadge": string;
  "settings.legalBadgeDesc": string;
  "settings.legalButton": string;
  "settings.signOut": string;
  "settings.signOutSuccess": string;

  // Search
  "search.placeholder": string;
  "search.searching": string;
  "search.resultsFor": string;
  "search.noResults": string;
  "search.myLibrary": string;
  "search.ccMixter": string;
  "search.browseAll": string;
  "search.allTracks": string;
  "search.freeLegalDownloads": string;
  "search.freeLegalDownloadsDesc": string;

  // Library
  "library.title": string;
  "library.populate20k": string;
  "library.populating": string;
  "library.spotifyImport": string;
  "library.uploadFile": string;
  "library.importYoutube": string;
  "library.createPlaylist": string;
  "library.likedSongs": string;
  "library.recentlyPlayed": string;
  "library.yourPlaylists": string;
  "library.noPlaylists": string;
  "library.songs": string;
  "library.plays": string;
  "library.liveStreaming": string;
  "library.spotifyImportTitle": string;
  "library.spotifyImportDesc": string;
  "library.pasteToken": string;
  "library.import": string;
  "library.importing": string;

  // Liked Songs
  "liked.title": string;
  "liked.playlist": string;
  "liked.songs": string;
  "liked.play": string;
  "liked.shuffle": string;
  "liked.empty": string;

  // Radio
  "radio.openFullPlayer": string;

  // Movies
  "movies.title": string;
  "movies.moviesInDb": string;
  "movies.searchYoutube": string;
  "movies.searching": string;
  "movies.populate20k": string;
  "movies.populating": string;
  "movies.all": string;
  "movies.polish": string;
  "movies.foreign": string;
  "movies.empty": string;
  "movies.notFound": string;
  "movies.searchError": string;

  // Mood History
  "mood.title": string;
  "mood.aiAnalysis": string;
  "mood.noData": string;
  "mood.noDataDesc": string;
  "mood.startScan": string;
  "mood.loginRequired": string;
  "mood.loginRequiredDesc": string;
  "mood.login": string;
  "mood.days": string;

  // Common
  "common.loading": string;
  "common.error": string;
  "common.save": string;
  "common.cancel": string;
  "common.delete": string;
  "common.close": string;
  "common.confirm": string;
  "common.yes": string;
  "common.no": string;

  // Sections
  "section.madeForYou": string;
  "section.madeForYouDesc": string;
  "section.trendingNow": string;
  "section.trendingNowDesc": string;
  "section.recentlyPlayed": string;
  "section.topArtists": string;

  // Legal page
  "legal.title": string;
  "legal.subtitle": string;
  "legal.terms": string;
  "legal.privacy": string;
  "legal.copyright": string;
  "legal.cookies": string;
  "legal.gdpr": string;
};

const pl: TranslationKeys = {
  "nav.home": "Strona główna",
  "nav.search": "Szukaj",
  "nav.library": "Twoja Biblioteka",
  "nav.createPlaylist": "Utwórz Playlistę",
  "nav.likedSongs": "Polubione Utwory",
  "nav.managePlaylists": "Zarządzaj Playlistami",
  "nav.mediaServer": "Serwer Mediów",
  "nav.movies": "Filmy",
  "nav.radioLive": "GrouaRadio Live",
  "nav.importYoutube": "Import YouTube",
  "nav.aiDj": "AI DJ",
  "nav.moodDetection": "Detekcja Nastroju",
  "nav.moodHistory": "Historia Nastrojów",
  "nav.realtimeAdaptation": "Adaptacja w czasie rzeczywistym",
  "nav.adminPanel": "Panel Admina",
  "nav.settings": "Ustawienia",
  "nav.legalDocs": "Dokumenty prawne",
  "nav.aiFeatures": "Funkcje AI",

  "topbar.searchPlaceholder": "Czego chcesz posłuchać?",
  "topbar.signIn": "Zaloguj się",
  "topbar.upgrade": "Ulepsz",
  "topbar.notifications": "Powiadomienia",
  "topbar.aiDjReady": "Twój AI DJ jest gotowy!",
  "topbar.aiDjReadyDesc": "Na podstawie Twojego nastroju stworzyliśmy spersonalizowaną playlistę",
  "topbar.newTracks": "Nowe utwory dodane!",
  "topbar.newTracksDesc": "Sprawdź nowe hity Rock, Punk i Pop",
  "topbar.loggedIn": "Zalogowany",
  "topbar.profile": "Profil",
  "topbar.yourLibrary": "Twoja Biblioteka",
  "topbar.likedSongs": "Polubione Utwory",
  "topbar.settings": "Ustawienia",
  "topbar.aiPreferences": "Preferencje AI",
  "topbar.signOut": "Wyloguj się",
  "topbar.myAccount": "Moje Konto",
  "topbar.createAccount": "Utwórz Konto",

  "hero.badge": "GrouAI Stream",
  "hero.title1": "Muzyka, Która ",
  "hero.titleHighlight": "Rozumie",
  "hero.title2": " Ciebie",
  "hero.subtitle": "Doświadcz przyszłości streamingu muzycznego z AI, które uczy się Twojego nastroju, dostosowuje się do Twojego rytmu i tworzy idealną ścieżkę dźwiękową na każdą chwilę.",
  "hero.startListening": "Zacznij Słuchać Za Darmo",
  "hero.liveRadio": "Radio na żywo",
  "hero.moodDetection": "Detekcja Nastroju",
  "hero.realtimeAdaptation": "Adaptacja w czasie rzeczywistym",
  "hero.aiPlaylists": "Playlisty AI",
  "hero.nowPlaying": "Odtwarzam Twój spersonalizowany mix!",
  "hero.noTracks": "Brak dostępnych utworów. Sprawdź ponownie wkrótce!",
  "hero.failedLoad": "Nie udało się załadować utworów. Spróbuj ponownie.",
  "hero.enableMoodDetection": "Włącz Detekcję Nastroju w Ustawieniach → AI i Prywatność",
  "hero.realtimeActive": "Adaptacja w czasie rzeczywistym jest aktywna podczas słuchania!",

  "settings.title": "Ustawienia",
  "settings.profile": "Profil",
  "settings.displayName": "Nazwa wyświetlana",
  "settings.saveChanges": "Zapisz zmiany",
  "settings.saving": "Zapisywanie...",
  "settings.profileUpdated": "Profil zaktualizowany!",
  "settings.profileError": "Nie udało się zaktualizować profilu",
  "settings.changeAvatar": "Zmień avatar",
  "settings.avatarUpdated": "Avatar zaktualizowany!",
  "settings.avatarError": "Nie udało się przesłać avatara",
  "settings.aiPrivacy": "AI i Prywatność",
  "settings.aiPrivacyDesc": "Kontroluj jak GrooveAI uczy się z Twoich zachowań. Wszystkie dane są anonimizowane i bezpiecznie przetwarzane.",
  "settings.moodDetection": "Detekcja Nastroju",
  "settings.moodDetectionDesc": "AI analizuje wzorce słuchania, aby wykryć nastrój",
  "settings.webcamMood": "Analiza Nastroju z Kamery",
  "settings.webcamMoodDesc": "Użyj wyrazu twarzy do detekcji nastroju",
  "settings.voiceEmotion": "Analiza Emocji Głosu",
  "settings.voiceEmotionDesc": "Analizuj głos dla lepszych rekomendacji",
  "settings.listeningHistory": "Historia Słuchania",
  "settings.listeningHistoryDesc": "Śledź słuchanie dla personalizacji",
  "settings.notifications": "Powiadomienia",
  "settings.newReleases": "Nowe Wydania",
  "settings.newReleasesDesc": "Od artystów, których obserwujesz",
  "settings.playlistUpdates": "Aktualizacje Playlist",
  "settings.playlistUpdatesDesc": "Zmiany i aktualizacje playlist AI",
  "settings.aiRecommendations": "Rekomendacje AI",
  "settings.aiRecommendationsDesc": "Spersonalizowane sugestie muzyczne",
  "settings.dataManagement": "Zarządzanie Danymi",
  "settings.deleteHistory": "Usuń Historię Słuchania",
  "settings.deleteHistoryConfirm": "Czy na pewno chcesz usunąć całą historię słuchania? Tego nie można cofnąć.",
  "settings.deleteHistorySuccess": "Historia słuchania usunięta",
  "settings.deleteHistoryError": "Nie udało się usunąć historii",
  "settings.gdprCompliant": "Zgodne z RODO. Zażądaj pełnego eksportu danych: privacy@grooveai.stream",
  "settings.legalCompliance": "Legalność i zgodność z prawem",
  "settings.legalBadge": "✅ Wszystkie treści w GrouAI Stream są w pełni legalne",
  "settings.legalBadgeDesc": "Muzyka pochodzi z legalnych źródeł: Creative Commons (CC Mixter), oficjalne YouTube Embed API, oraz treści przesłane przez użytkowników z odpowiednimi prawami. Działamy zgodnie z RODO, Dyrektywą DSM 2019/790 oraz YouTube/Spotify API Terms of Service.",
  "settings.legalButton": "Regulamin, Polityka Prywatności, RODO i prawa autorskie",
  "settings.signOut": "Wyloguj się",
  "settings.signOutSuccess": "Wylogowano pomyślnie",

  "search.placeholder": "Szukaj utworów, artystów lub gatunków...",
  "search.searching": "Szukanie...",
  "search.resultsFor": "Wyniki dla",
  "search.noResults": "Brak wyników",
  "search.myLibrary": "Moja Biblioteka",
  "search.ccMixter": "CC Mixter (Darmowe)",
  "search.browseAll": "Przeglądaj Wszystko",
  "search.allTracks": "Wszystkie Utwory",
  "search.freeLegalDownloads": "Darmowe Legalne Pobieranie",
  "search.freeLegalDownloadsDesc": "Wszystkie poniższe utwory są na licencji Creative Commons. Pobieraj legalnie z odpowiednią atrybucją.",

  "library.title": "Twoja Biblioteka",
  "library.populate20k": "Wypełnij 20k",
  "library.populating": "Wypełniam...",
  "library.spotifyImport": "Import Spotify",
  "library.uploadFile": "Prześlij Plik",
  "library.importYoutube": "Import YouTube",
  "library.createPlaylist": "Utwórz Playlistę",
  "library.likedSongs": "Polubione Utwory",
  "library.recentlyPlayed": "Ostatnio Odtwarzane",
  "library.yourPlaylists": "Twoje Playlisty",
  "library.noPlaylists": "Brak playlist. Utwórz pierwszą playlistę!",
  "library.songs": "utworów",
  "library.plays": "odtworzeń",
  "library.liveStreaming": "Streaming na żywo",
  "library.spotifyImportTitle": "Import ze Spotify",
  "library.spotifyImportDesc": "Wklej swój token Spotify Bearer. Pobierzemy Twoje top tracks, polubione, playlisty i popularne utwory.",
  "library.pasteToken": "Wklej token Spotify (Bearer token)...",
  "library.import": "Importuj",
  "library.importing": "Importuję...",

  "liked.title": "Polubione Utwory",
  "liked.playlist": "Playlista",
  "liked.songs": "utworów",
  "liked.play": "Odtwórz",
  "liked.shuffle": "Losowo",
  "liked.empty": "Brak polubionych utworów. Zacznij przeglądać i polub kilka utworów!",

  "radio.openFullPlayer": "Otwórz pełny player",

  "movies.title": "Filmy",
  "movies.moviesInDb": "filmów w bazie",
  "movies.searchYoutube": "Szukaj na YouTube",
  "movies.searching": "Szukam...",
  "movies.populate20k": "Wypełnij 20k",
  "movies.populating": "Wypełniam...",
  "movies.all": "Wszystkie",
  "movies.polish": "Polskie",
  "movies.foreign": "Zagraniczne",
  "movies.empty": "Brak filmów. Kliknij \"Wypełnij 20k\" aby dodać filmy!",
  "movies.notFound": "Nie znaleziono na YouTube",
  "movies.searchError": "Błąd wyszukiwania",

  "mood.title": "Historia Nastrojów",
  "mood.aiAnalysis": "Analiza AI Twojego samopoczucia",
  "mood.noData": "Brak danych o nastroju",
  "mood.noDataDesc": "Użyj funkcji skanowania nastroju na stronie głównej, aby rozpocząć zbieranie danych o swoim samopoczuciu.",
  "mood.startScan": "Rozpocznij skanowanie",
  "mood.loginRequired": "Wymagane logowanie",
  "mood.loginRequiredDesc": "Zaloguj się, aby zobaczyć historię nastrojów i analizę AI",
  "mood.login": "Zaloguj się",
  "mood.days": "dni",

  "common.loading": "Ładowanie...",
  "common.error": "Błąd",
  "common.save": "Zapisz",
  "common.cancel": "Anuluj",
  "common.delete": "Usuń",
  "common.close": "Zamknij",
  "common.confirm": "Potwierdź",
  "common.yes": "Tak",
  "common.no": "Nie",

  "section.madeForYou": "Stworzone Dla Ciebie przez AI",
  "section.madeForYouDesc": "Playlisty dopasowane na podstawie Twojego nastroju i wzorców słuchania",
  "section.trendingNow": "Popularne Teraz",
  "section.trendingNowDesc": "Czego słucha świat",
  "section.recentlyPlayed": "Ostatnio Odtwarzane",
  "section.topArtists": "Najlepsi Artyści",

  "legal.title": "Dokumenty prawne",
  "legal.subtitle": "GrouAI Stream działa w pełni legalnie i zgodnie z obowiązującym prawem UE, RODO oraz międzynarodowymi regulacjami dotyczącymi praw autorskich.",
  "legal.terms": "Regulamin",
  "legal.privacy": "Prywatność",
  "legal.copyright": "Prawa autorskie",
  "legal.cookies": "Cookies",
  "legal.gdpr": "RODO",
};

const en: TranslationKeys = {
  "nav.home": "Home",
  "nav.search": "Search",
  "nav.library": "Your Library",
  "nav.createPlaylist": "Create Playlist",
  "nav.likedSongs": "Liked Songs",
  "nav.managePlaylists": "Manage Playlists",
  "nav.mediaServer": "Media Server",
  "nav.movies": "Movies",
  "nav.radioLive": "GrouaRadio Live",
  "nav.importYoutube": "Import YouTube",
  "nav.aiDj": "AI DJ",
  "nav.moodDetection": "Mood Detection",
  "nav.moodHistory": "Mood History",
  "nav.realtimeAdaptation": "Real-time Adaptation",
  "nav.adminPanel": "Admin Panel",
  "nav.settings": "Settings",
  "nav.legalDocs": "Legal Documents",
  "nav.aiFeatures": "AI Features",

  "topbar.searchPlaceholder": "What do you want to listen to?",
  "topbar.signIn": "Sign In",
  "topbar.upgrade": "Upgrade",
  "topbar.notifications": "Notifications",
  "topbar.aiDjReady": "Your AI DJ is ready!",
  "topbar.aiDjReadyDesc": "Based on your mood, we've created a personalized playlist",
  "topbar.newTracks": "New tracks added!",
  "topbar.newTracksDesc": "Check out new Rock, Punk, and Pop hits",
  "topbar.loggedIn": "Logged in",
  "topbar.profile": "Profile",
  "topbar.yourLibrary": "Your Library",
  "topbar.likedSongs": "Liked Songs",
  "topbar.settings": "Settings",
  "topbar.aiPreferences": "AI Preferences",
  "topbar.signOut": "Sign Out",
  "topbar.myAccount": "My Account",
  "topbar.createAccount": "Create Account",

  "hero.badge": "GrouAI Stream",
  "hero.title1": "Music That ",
  "hero.titleHighlight": "Understands",
  "hero.title2": " You",
  "hero.subtitle": "Experience the future of music streaming with AI that learns your mood, adapts to your rhythm, and creates the perfect soundtrack for every moment.",
  "hero.startListening": "Start Listening Free",
  "hero.liveRadio": "Live Radio",
  "hero.moodDetection": "Mood Detection",
  "hero.realtimeAdaptation": "Real-time Adaptation",
  "hero.aiPlaylists": "AI Playlists",
  "hero.nowPlaying": "Now playing your personalized mix!",
  "hero.noTracks": "No tracks available yet. Check back soon!",
  "hero.failedLoad": "Failed to load tracks. Please try again.",
  "hero.enableMoodDetection": "Enable Mood Detection in Settings → AI & Privacy",
  "hero.realtimeActive": "Real-time adaptation is always active while you listen!",

  "settings.title": "Settings",
  "settings.profile": "Profile",
  "settings.displayName": "Display Name",
  "settings.saveChanges": "Save Changes",
  "settings.saving": "Saving...",
  "settings.profileUpdated": "Profile updated!",
  "settings.profileError": "Failed to update profile",
  "settings.changeAvatar": "Change avatar",
  "settings.avatarUpdated": "Avatar updated!",
  "settings.avatarError": "Failed to upload avatar",
  "settings.aiPrivacy": "AI & Privacy",
  "settings.aiPrivacyDesc": "Control how GrooveAI learns from your behavior. All data is anonymized and processed securely.",
  "settings.moodDetection": "Mood Detection",
  "settings.moodDetectionDesc": "AI analyzes listening patterns to detect mood",
  "settings.webcamMood": "Webcam Mood Analysis",
  "settings.webcamMoodDesc": "Use facial expressions for mood detection",
  "settings.voiceEmotion": "Voice Emotion Analysis",
  "settings.voiceEmotionDesc": "Analyze voice for better recommendations",
  "settings.listeningHistory": "Listening History",
  "settings.listeningHistoryDesc": "Track listening for personalization",
  "settings.notifications": "Notifications",
  "settings.newReleases": "New Releases",
  "settings.newReleasesDesc": "From artists you follow",
  "settings.playlistUpdates": "Playlist Updates",
  "settings.playlistUpdatesDesc": "AI playlist changes and updates",
  "settings.aiRecommendations": "AI Recommendations",
  "settings.aiRecommendationsDesc": "Personalized music suggestions",
  "settings.dataManagement": "Data Management",
  "settings.deleteHistory": "Delete Listening History",
  "settings.deleteHistoryConfirm": "Are you sure you want to delete all your listening history? This cannot be undone.",
  "settings.deleteHistorySuccess": "Listening history deleted",
  "settings.deleteHistoryError": "Failed to delete history",
  "settings.gdprCompliant": "GDPR compliant. Request full data export via email: privacy@grooveai.stream",
  "settings.legalCompliance": "Legal & Compliance",
  "settings.legalBadge": "✅ All content on GrouAI Stream is fully legal",
  "settings.legalBadgeDesc": "Music comes from legal sources: Creative Commons (CC Mixter), official YouTube Embed API, and user-uploaded content with proper rights. We comply with GDPR, DSM Directive 2019/790, and YouTube/Spotify API Terms of Service.",
  "settings.legalButton": "Terms of Service, Privacy Policy, GDPR & Copyright",
  "settings.signOut": "Sign Out",
  "settings.signOutSuccess": "Signed out successfully",

  "search.placeholder": "Search for songs, artists, or genres...",
  "search.searching": "Searching...",
  "search.resultsFor": "Results for",
  "search.noResults": "No results found",
  "search.myLibrary": "My Library",
  "search.ccMixter": "CC Mixter (Free)",
  "search.browseAll": "Browse All",
  "search.allTracks": "All Tracks",
  "search.freeLegalDownloads": "Free Legal Downloads",
  "search.freeLegalDownloadsDesc": "All tracks below are licensed under Creative Commons. Download legally with proper attribution.",

  "library.title": "Your Library",
  "library.populate20k": "Populate 20k",
  "library.populating": "Populating...",
  "library.spotifyImport": "Spotify Import",
  "library.uploadFile": "Upload File",
  "library.importYoutube": "Import YouTube",
  "library.createPlaylist": "Create Playlist",
  "library.likedSongs": "Liked Songs",
  "library.recentlyPlayed": "Recently Played",
  "library.yourPlaylists": "Your Playlists",
  "library.noPlaylists": "No playlists yet. Create your first playlist!",
  "library.songs": "songs",
  "library.plays": "plays",
  "library.liveStreaming": "Live streaming",
  "library.spotifyImportTitle": "Spotify Import",
  "library.spotifyImportDesc": "Paste your Spotify Bearer token. We'll import your top tracks, liked songs, playlists and popular tracks.",
  "library.pasteToken": "Paste Spotify token (Bearer token)...",
  "library.import": "Import",
  "library.importing": "Importing...",

  "liked.title": "Liked Songs",
  "liked.playlist": "Playlist",
  "liked.songs": "songs",
  "liked.play": "Play",
  "liked.shuffle": "Shuffle",
  "liked.empty": "No liked songs yet. Start exploring and like some tracks!",

  "radio.openFullPlayer": "Open full player",

  "movies.title": "Movies",
  "movies.moviesInDb": "movies in database",
  "movies.searchYoutube": "Search on YouTube",
  "movies.searching": "Searching...",
  "movies.populate20k": "Populate 20k",
  "movies.populating": "Populating...",
  "movies.all": "All",
  "movies.polish": "Polish",
  "movies.foreign": "Foreign",
  "movies.empty": "No movies. Click \"Populate 20k\" to add movies!",
  "movies.notFound": "Not found on YouTube",
  "movies.searchError": "Search error",

  "mood.title": "Mood History",
  "mood.aiAnalysis": "AI analysis of your wellbeing",
  "mood.noData": "No mood data",
  "mood.noDataDesc": "Use the mood scanning feature on the homepage to start collecting data about your wellbeing.",
  "mood.startScan": "Start scanning",
  "mood.loginRequired": "Login required",
  "mood.loginRequiredDesc": "Sign in to see mood history and AI analysis",
  "mood.login": "Sign In",
  "mood.days": "days",

  "common.loading": "Loading...",
  "common.error": "Error",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",

  "section.madeForYou": "Made For You by AI",
  "section.madeForYouDesc": "Playlists curated based on your mood and listening patterns",
  "section.trendingNow": "Trending Now",
  "section.trendingNowDesc": "What the world is listening to",
  "section.recentlyPlayed": "Recently Played",
  "section.topArtists": "Top Artists",

  "legal.title": "Legal Documents",
  "legal.subtitle": "GrouAI Stream operates fully legally and in compliance with EU law, GDPR, and international copyright regulations.",
  "legal.terms": "Terms",
  "legal.privacy": "Privacy",
  "legal.copyright": "Copyright",
  "legal.cookies": "Cookies",
  "legal.gdpr": "GDPR",
};

const nl: TranslationKeys = {
  "nav.home": "Startpagina",
  "nav.search": "Zoeken",
  "nav.library": "Jouw Bibliotheek",
  "nav.createPlaylist": "Afspeellijst Maken",
  "nav.likedSongs": "Favoriete Nummers",
  "nav.managePlaylists": "Afspeellijsten Beheren",
  "nav.mediaServer": "Mediaserver",
  "nav.movies": "Films",
  "nav.radioLive": "GrouaRadio Live",
  "nav.importYoutube": "YouTube Importeren",
  "nav.aiDj": "AI DJ",
  "nav.moodDetection": "Stemming Detectie",
  "nav.moodHistory": "Stemmingsgeschiedenis",
  "nav.realtimeAdaptation": "Realtime Aanpassing",
  "nav.adminPanel": "Beheerders Paneel",
  "nav.settings": "Instellingen",
  "nav.legalDocs": "Juridische Documenten",
  "nav.aiFeatures": "AI Functies",

  "topbar.searchPlaceholder": "Waar wil je naar luisteren?",
  "topbar.signIn": "Inloggen",
  "topbar.upgrade": "Upgraden",
  "topbar.notifications": "Meldingen",
  "topbar.aiDjReady": "Je AI DJ is klaar!",
  "topbar.aiDjReadyDesc": "Op basis van je stemming hebben we een gepersonaliseerde afspeellijst gemaakt",
  "topbar.newTracks": "Nieuwe nummers toegevoegd!",
  "topbar.newTracksDesc": "Bekijk nieuwe Rock, Punk en Pop hits",
  "topbar.loggedIn": "Ingelogd",
  "topbar.profile": "Profiel",
  "topbar.yourLibrary": "Jouw Bibliotheek",
  "topbar.likedSongs": "Favoriete Nummers",
  "topbar.settings": "Instellingen",
  "topbar.aiPreferences": "AI Voorkeuren",
  "topbar.signOut": "Uitloggen",
  "topbar.myAccount": "Mijn Account",
  "topbar.createAccount": "Account Aanmaken",

  "hero.badge": "GrouAI Stream",
  "hero.title1": "Muziek Die Je ",
  "hero.titleHighlight": "Begrijpt",
  "hero.title2": "",
  "hero.subtitle": "Ervaar de toekomst van muziekstreaming met AI die je stemming leert, zich aanpast aan je ritme en de perfecte soundtrack creëert voor elk moment.",
  "hero.startListening": "Gratis Beginnen Met Luisteren",
  "hero.liveRadio": "Live Radio",
  "hero.moodDetection": "Stemming Detectie",
  "hero.realtimeAdaptation": "Realtime Aanpassing",
  "hero.aiPlaylists": "AI Afspeellijsten",
  "hero.nowPlaying": "Nu speelt je gepersonaliseerde mix!",
  "hero.noTracks": "Nog geen nummers beschikbaar. Kom snel terug!",
  "hero.failedLoad": "Nummers laden mislukt. Probeer het opnieuw.",
  "hero.enableMoodDetection": "Schakel Stemming Detectie in via Instellingen → AI & Privacy",
  "hero.realtimeActive": "Realtime aanpassing is altijd actief terwijl je luistert!",

  "settings.title": "Instellingen",
  "settings.profile": "Profiel",
  "settings.displayName": "Weergavenaam",
  "settings.saveChanges": "Wijzigingen Opslaan",
  "settings.saving": "Opslaan...",
  "settings.profileUpdated": "Profiel bijgewerkt!",
  "settings.profileError": "Profiel bijwerken mislukt",
  "settings.changeAvatar": "Avatar wijzigen",
  "settings.avatarUpdated": "Avatar bijgewerkt!",
  "settings.avatarError": "Avatar uploaden mislukt",
  "settings.aiPrivacy": "AI & Privacy",
  "settings.aiPrivacyDesc": "Bepaal hoe GrooveAI leert van je gedrag. Alle gegevens worden geanonimiseerd en veilig verwerkt.",
  "settings.moodDetection": "Stemming Detectie",
  "settings.moodDetectionDesc": "AI analyseert luisterpatronen om stemming te detecteren",
  "settings.webcamMood": "Webcam Stemmingsanalyse",
  "settings.webcamMoodDesc": "Gebruik gezichtsuitdrukkingen voor stemmingsdetectie",
  "settings.voiceEmotion": "Stem Emotie Analyse",
  "settings.voiceEmotionDesc": "Analyseer stem voor betere aanbevelingen",
  "settings.listeningHistory": "Luistergeschiedenis",
  "settings.listeningHistoryDesc": "Volg luistergedrag voor personalisatie",
  "settings.notifications": "Meldingen",
  "settings.newReleases": "Nieuwe Releases",
  "settings.newReleasesDesc": "Van artiesten die je volgt",
  "settings.playlistUpdates": "Afspeellijst Updates",
  "settings.playlistUpdatesDesc": "AI afspeellijst wijzigingen en updates",
  "settings.aiRecommendations": "AI Aanbevelingen",
  "settings.aiRecommendationsDesc": "Gepersonaliseerde muzieksuggesties",
  "settings.dataManagement": "Gegevensbeheer",
  "settings.deleteHistory": "Luistergeschiedenis Verwijderen",
  "settings.deleteHistoryConfirm": "Weet je zeker dat je al je luistergeschiedenis wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
  "settings.deleteHistorySuccess": "Luistergeschiedenis verwijderd",
  "settings.deleteHistoryError": "Verwijderen van geschiedenis mislukt",
  "settings.gdprCompliant": "AVG-conform. Vraag volledige gegevensexport aan: privacy@grooveai.stream",
  "settings.legalCompliance": "Juridisch & Naleving",
  "settings.legalBadge": "✅ Alle content op GrouAI Stream is volledig legaal",
  "settings.legalBadgeDesc": "Muziek komt uit legale bronnen: Creative Commons (CC Mixter), officiële YouTube Embed API, en door gebruikers geüploade content met juiste rechten. We voldoen aan AVG, DSM Richtlijn 2019/790, en YouTube/Spotify API Terms of Service.",
  "settings.legalButton": "Algemene Voorwaarden, Privacybeleid, AVG & Auteursrecht",
  "settings.signOut": "Uitloggen",
  "settings.signOutSuccess": "Succesvol uitgelogd",

  "search.placeholder": "Zoek naar nummers, artiesten of genres...",
  "search.searching": "Zoeken...",
  "search.resultsFor": "Resultaten voor",
  "search.noResults": "Geen resultaten gevonden",
  "search.myLibrary": "Mijn Bibliotheek",
  "search.ccMixter": "CC Mixter (Gratis)",
  "search.browseAll": "Alles Bekijken",
  "search.allTracks": "Alle Nummers",
  "search.freeLegalDownloads": "Gratis Legale Downloads",
  "search.freeLegalDownloadsDesc": "Alle onderstaande nummers zijn gelicentieerd onder Creative Commons. Download legaal met juiste naamsvermelding.",

  "library.title": "Jouw Bibliotheek",
  "library.populate20k": "Vul 20k",
  "library.populating": "Vullen...",
  "library.spotifyImport": "Spotify Import",
  "library.uploadFile": "Bestand Uploaden",
  "library.importYoutube": "YouTube Importeren",
  "library.createPlaylist": "Afspeellijst Maken",
  "library.likedSongs": "Favoriete Nummers",
  "library.recentlyPlayed": "Recent Afgespeeld",
  "library.yourPlaylists": "Jouw Afspeellijsten",
  "library.noPlaylists": "Nog geen afspeellijsten. Maak je eerste afspeellijst!",
  "library.songs": "nummers",
  "library.plays": "keer afgespeeld",
  "library.liveStreaming": "Live streaming",
  "library.spotifyImportTitle": "Spotify Import",
  "library.spotifyImportDesc": "Plak je Spotify Bearer token. We importeren je topnummers, favorieten, afspeellijsten en populaire nummers.",
  "library.pasteToken": "Plak Spotify token (Bearer token)...",
  "library.import": "Importeren",
  "library.importing": "Importeren...",

  "liked.title": "Favoriete Nummers",
  "liked.playlist": "Afspeellijst",
  "liked.songs": "nummers",
  "liked.play": "Afspelen",
  "liked.shuffle": "Willekeurig",
  "liked.empty": "Nog geen favoriete nummers. Begin met ontdekken en like een paar nummers!",

  "radio.openFullPlayer": "Open volledige speler",

  "movies.title": "Films",
  "movies.moviesInDb": "films in database",
  "movies.searchYoutube": "Zoeken op YouTube",
  "movies.searching": "Zoeken...",
  "movies.populate20k": "Vul 20k",
  "movies.populating": "Vullen...",
  "movies.all": "Alle",
  "movies.polish": "Pools",
  "movies.foreign": "Buitenlands",
  "movies.empty": "Geen films. Klik op \"Vul 20k\" om films toe te voegen!",
  "movies.notFound": "Niet gevonden op YouTube",
  "movies.searchError": "Zoekfout",

  "mood.title": "Stemmingsgeschiedenis",
  "mood.aiAnalysis": "AI-analyse van je welzijn",
  "mood.noData": "Geen stemmingsgegevens",
  "mood.noDataDesc": "Gebruik de stemmingscanfunctie op de startpagina om gegevens over je welzijn te verzamelen.",
  "mood.startScan": "Begin met scannen",
  "mood.loginRequired": "Inloggen vereist",
  "mood.loginRequiredDesc": "Log in om stemmingsgeschiedenis en AI-analyse te bekijken",
  "mood.login": "Inloggen",
  "mood.days": "dagen",

  "common.loading": "Laden...",
  "common.error": "Fout",
  "common.save": "Opslaan",
  "common.cancel": "Annuleren",
  "common.delete": "Verwijderen",
  "common.close": "Sluiten",
  "common.confirm": "Bevestigen",
  "common.yes": "Ja",
  "common.no": "Nee",

  "section.madeForYou": "Gemaakt Voor Jou door AI",
  "section.madeForYouDesc": "Afspeellijsten samengesteld op basis van je stemming en luisterpatronen",
  "section.trendingNow": "Nu Trending",
  "section.trendingNowDesc": "Waar de wereld naar luistert",
  "section.recentlyPlayed": "Recent Afgespeeld",
  "section.topArtists": "Top Artiesten",

  "legal.title": "Juridische Documenten",
  "legal.subtitle": "GrouAI Stream opereert volledig legaal en in overeenstemming met EU-wetgeving, AVG en internationale auteursrechtregelingen.",
  "legal.terms": "Voorwaarden",
  "legal.privacy": "Privacy",
  "legal.copyright": "Auteursrecht",
  "legal.cookies": "Cookies",
  "legal.gdpr": "AVG",
};

const ua: TranslationKeys = {
  "nav.home": "Головна",
  "nav.search": "Пошук",
  "nav.library": "Ваша Бібліотека",
  "nav.createPlaylist": "Створити Плейлист",
  "nav.likedSongs": "Вподобані Пісні",
  "nav.managePlaylists": "Керувати Плейлистами",
  "nav.mediaServer": "Медіа Сервер",
  "nav.movies": "Фільми",
  "nav.radioLive": "GrouaRadio Live",
  "nav.importYoutube": "Імпорт YouTube",
  "nav.aiDj": "AI DJ",
  "nav.moodDetection": "Визначення Настрою",
  "nav.moodHistory": "Історія Настрою",
  "nav.realtimeAdaptation": "Адаптація в реальному часі",
  "nav.adminPanel": "Панель Адміна",
  "nav.settings": "Налаштування",
  "nav.legalDocs": "Юридичні Документи",
  "nav.aiFeatures": "Функції AI",

  "topbar.searchPlaceholder": "Що хочеш послухати?",
  "topbar.signIn": "Увійти",
  "topbar.upgrade": "Покращити",
  "topbar.notifications": "Сповіщення",
  "topbar.aiDjReady": "Ваш AI DJ готовий!",
  "topbar.aiDjReadyDesc": "На основі вашого настрою ми створили персоналізований плейлист",
  "topbar.newTracks": "Нові треки додані!",
  "topbar.newTracksDesc": "Перегляньте нові хіти Rock, Punk та Pop",
  "topbar.loggedIn": "Увійшов",
  "topbar.profile": "Профіль",
  "topbar.yourLibrary": "Ваша Бібліотека",
  "topbar.likedSongs": "Вподобані Пісні",
  "topbar.settings": "Налаштування",
  "topbar.aiPreferences": "Налаштування AI",
  "topbar.signOut": "Вийти",
  "topbar.myAccount": "Мій Акаунт",
  "topbar.createAccount": "Створити Акаунт",

  "hero.badge": "GrouAI Stream",
  "hero.title1": "Музика, Яка ",
  "hero.titleHighlight": "Розуміє",
  "hero.title2": " Тебе",
  "hero.subtitle": "Відчуйте майбутнє музичного стримінгу з AI, яке вивчає ваш настрій, адаптується до вашого ритму та створює ідеальний саундтрек для кожного моменту.",
  "hero.startListening": "Почати Слухати Безкоштовно",
  "hero.liveRadio": "Живе Радіо",
  "hero.moodDetection": "Визначення Настрою",
  "hero.realtimeAdaptation": "Адаптація в реальному часі",
  "hero.aiPlaylists": "AI Плейлисти",
  "hero.nowPlaying": "Зараз грає ваш персоналізований мікс!",
  "hero.noTracks": "Поки немає доступних треків. Перевірте пізніше!",
  "hero.failedLoad": "Не вдалося завантажити треки. Спробуйте ще раз.",
  "hero.enableMoodDetection": "Увімкніть Визначення Настрою в Налаштуваннях → AI та Приватність",
  "hero.realtimeActive": "Адаптація в реальному часі завжди активна під час прослуховування!",

  "settings.title": "Налаштування",
  "settings.profile": "Профіль",
  "settings.displayName": "Ім'я для відображення",
  "settings.saveChanges": "Зберегти Зміни",
  "settings.saving": "Збереження...",
  "settings.profileUpdated": "Профіль оновлено!",
  "settings.profileError": "Не вдалося оновити профіль",
  "settings.changeAvatar": "Змінити аватар",
  "settings.avatarUpdated": "Аватар оновлено!",
  "settings.avatarError": "Не вдалося завантажити аватар",
  "settings.aiPrivacy": "AI та Приватність",
  "settings.aiPrivacyDesc": "Контролюйте, як GrooveAI навчається з вашої поведінки. Всі дані анонімізуються та безпечно обробляються.",
  "settings.moodDetection": "Визначення Настрою",
  "settings.moodDetectionDesc": "AI аналізує патерни прослуховування для визначення настрою",
  "settings.webcamMood": "Аналіз Настрою з Камери",
  "settings.webcamMoodDesc": "Використовуйте вираз обличчя для визначення настрою",
  "settings.voiceEmotion": "Аналіз Емоцій Голосу",
  "settings.voiceEmotionDesc": "Аналізуйте голос для кращих рекомендацій",
  "settings.listeningHistory": "Історія Прослуховування",
  "settings.listeningHistoryDesc": "Відстежуйте прослуховування для персоналізації",
  "settings.notifications": "Сповіщення",
  "settings.newReleases": "Нові Релізи",
  "settings.newReleasesDesc": "Від артистів, яких ви відстежуєте",
  "settings.playlistUpdates": "Оновлення Плейлистів",
  "settings.playlistUpdatesDesc": "Зміни та оновлення AI плейлистів",
  "settings.aiRecommendations": "AI Рекомендації",
  "settings.aiRecommendationsDesc": "Персоналізовані музичні пропозиції",
  "settings.dataManagement": "Керування Даними",
  "settings.deleteHistory": "Видалити Історію Прослуховування",
  "settings.deleteHistoryConfirm": "Ви впевнені, що хочете видалити всю історію прослуховування? Це неможливо скасувати.",
  "settings.deleteHistorySuccess": "Історію прослуховування видалено",
  "settings.deleteHistoryError": "Не вдалося видалити історію",
  "settings.gdprCompliant": "Відповідає GDPR. Запросіть повний експорт даних: privacy@grooveai.stream",
  "settings.legalCompliance": "Юридична Відповідність",
  "settings.legalBadge": "✅ Весь контент на GrouAI Stream повністю легальний",
  "settings.legalBadgeDesc": "Музика з легальних джерел: Creative Commons (CC Mixter), офіційне YouTube Embed API, та контент завантажений користувачами з відповідними правами. Ми дотримуємося GDPR, Директиви DSM 2019/790 та YouTube/Spotify API Terms of Service.",
  "settings.legalButton": "Умови Використання, Політика Конфіденційності, GDPR та Авторські Права",
  "settings.signOut": "Вийти",
  "settings.signOutSuccess": "Успішно вийшли",

  "search.placeholder": "Шукайте пісні, артистів або жанри...",
  "search.searching": "Пошук...",
  "search.resultsFor": "Результати для",
  "search.noResults": "Нічого не знайдено",
  "search.myLibrary": "Моя Бібліотека",
  "search.ccMixter": "CC Mixter (Безкоштовно)",
  "search.browseAll": "Переглянути Все",
  "search.allTracks": "Всі Треки",
  "search.freeLegalDownloads": "Безкоштовні Легальні Завантаження",
  "search.freeLegalDownloadsDesc": "Всі треки нижче ліцензовані під Creative Commons. Завантажуйте легально з належною атрибуцією.",

  "library.title": "Ваша Бібліотека",
  "library.populate20k": "Заповнити 20к",
  "library.populating": "Заповнення...",
  "library.spotifyImport": "Імпорт Spotify",
  "library.uploadFile": "Завантажити Файл",
  "library.importYoutube": "Імпорт YouTube",
  "library.createPlaylist": "Створити Плейлист",
  "library.likedSongs": "Вподобані Пісні",
  "library.recentlyPlayed": "Нещодавно Відтворене",
  "library.yourPlaylists": "Ваші Плейлисти",
  "library.noPlaylists": "Поки немає плейлистів. Створіть перший плейлист!",
  "library.songs": "пісень",
  "library.plays": "відтворень",
  "library.liveStreaming": "Живе мовлення",
  "library.spotifyImportTitle": "Імпорт Spotify",
  "library.spotifyImportDesc": "Вставте ваш Spotify Bearer token. Ми імпортуємо ваші топ треки, вподобані, плейлисти та популярні треки.",
  "library.pasteToken": "Вставте Spotify token (Bearer token)...",
  "library.import": "Імпортувати",
  "library.importing": "Імпортування...",

  "liked.title": "Вподобані Пісні",
  "liked.playlist": "Плейлист",
  "liked.songs": "пісень",
  "liked.play": "Відтворити",
  "liked.shuffle": "Перемішати",
  "liked.empty": "Поки немає вподобаних пісень. Почніть досліджувати та вподобайте декілька треків!",

  "radio.openFullPlayer": "Відкрити повний плеєр",

  "movies.title": "Фільми",
  "movies.moviesInDb": "фільмів у базі",
  "movies.searchYoutube": "Шукати на YouTube",
  "movies.searching": "Пошук...",
  "movies.populate20k": "Заповнити 20к",
  "movies.populating": "Заповнення...",
  "movies.all": "Всі",
  "movies.polish": "Польські",
  "movies.foreign": "Закордонні",
  "movies.empty": "Немає фільмів. Натисніть \"Заповнити 20к\" щоб додати фільми!",
  "movies.notFound": "Не знайдено на YouTube",
  "movies.searchError": "Помилка пошуку",

  "mood.title": "Історія Настрою",
  "mood.aiAnalysis": "AI аналіз вашого самопочуття",
  "mood.noData": "Немає даних про настрій",
  "mood.noDataDesc": "Використовуйте функцію сканування настрою на головній сторінці, щоб почати збирати дані про ваше самопочуття.",
  "mood.startScan": "Почати сканування",
  "mood.loginRequired": "Потрібен вхід",
  "mood.loginRequiredDesc": "Увійдіть, щоб побачити історію настрою та AI аналіз",
  "mood.login": "Увійти",
  "mood.days": "днів",

  "common.loading": "Завантаження...",
  "common.error": "Помилка",
  "common.save": "Зберегти",
  "common.cancel": "Скасувати",
  "common.delete": "Видалити",
  "common.close": "Закрити",
  "common.confirm": "Підтвердити",
  "common.yes": "Так",
  "common.no": "Ні",

  "section.madeForYou": "Створено Для Вас за допомогою AI",
  "section.madeForYouDesc": "Плейлисти підібрані на основі вашого настрою та патернів прослуховування",
  "section.trendingNow": "Зараз у Тренді",
  "section.trendingNowDesc": "Що слухає світ",
  "section.recentlyPlayed": "Нещодавно Відтворене",
  "section.topArtists": "Топ Артисти",

  "legal.title": "Юридичні Документи",
  "legal.subtitle": "GrouAI Stream працює повністю легально та відповідно до законодавства ЄС, GDPR та міжнародних норм авторського права.",
  "legal.terms": "Умови",
  "legal.privacy": "Приватність",
  "legal.copyright": "Авторські Права",
  "legal.cookies": "Cookies",
  "legal.gdpr": "GDPR",
};

export const translations: Record<Language, TranslationKeys> = { pl, en, nl, ua };
