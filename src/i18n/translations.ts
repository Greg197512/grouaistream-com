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
  "nav.sunoAI": string;
  "nav.localPlayer": string;
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
  "library.startingPopulate": string;
  "library.batchFetching": string;
  "library.batchAdded": string;
  "library.goalReached": string;
  "library.donePopulated": string;
  "library.populatedSuccess": string;
  "library.populateError": string;
  "library.pasteTokenError": string;
  "library.fetchingSpotify": string;
  "library.spotifyDone": string;
  "library.spotifyAddedSuccess": string;
  "library.spotifyImportError": string;
  "library.spotifyImportErrorMsg": string;
  "library.genreCatalogs": string;
  "library.aiSortsAuto": string;
  "library.tracks": string;
  "library.playAll": string;
  "library.deleteCatalog": string;
  "library.play": string;
  "library.noTracksInCatalog": string;
  "library.catalogDeleted": string;
  "library.catalogEmpty": string;

  // Liked Songs
  "liked.title": string;
  "liked.playlist": string;
  "liked.songs": string;
  "liked.play": string;
  "liked.shuffle": string;
  "liked.empty": string;

  // Radio
  "radio.openFullPlayer": string;
  "radio.backHome": string;
  "radio.nowPlaying": string;
  "radio.live": string;
  "radio.stationOff": string;
  "radio.broadcasting": string;
  "radio.upNext": string;
  "radio.poweredBy": string;
  "radio.loginToLike": string;
  "radio.loginToLikeDesc": string;
  "radio.unliked": string;
  "radio.liked": string;
  "radio.likedDesc": string;
  "radio.likesCount": string;
  "radio.wishes": string;
  "radio.wishesTitle": string;
  "radio.wishPlaceholder": string;
  "radio.sendWish": string;
  "radio.loginToChat": string;
  "radio.deleteWish": string;
  "radio.noWishes": string;

  // Widget tooltips
  "widget.micTooltip": string;
  "widget.chatTooltip": string;

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
  "legal.lastUpdate": string;

  // Terms
  "legal.terms.heading": string;
  "legal.terms.s1.title": string;
  "legal.terms.s1.p1": string;
  "legal.terms.s1.p2": string;
  "legal.terms.s1.p3": string;
  "legal.terms.s2.title": string;
  "legal.terms.s2.badge": string;
  "legal.terms.s2.badgeDesc": string;
  "legal.terms.s2.p1": string;
  "legal.terms.s2.p2": string;
  "legal.terms.s2.p3": string;
  "legal.terms.s2.p4": string;
  "legal.terms.s3.title": string;
  "legal.terms.s3.p1": string;
  "legal.terms.s3.p2": string;
  "legal.terms.s3.p3": string;
  "legal.terms.s4.title": string;
  "legal.terms.s4.p1": string;
  "legal.terms.s4.p2": string;
  "legal.terms.s4.p3": string;
  "legal.terms.s5.title": string;
  "legal.terms.s5.p1": string;
  "legal.terms.s5.p2": string;
  "legal.terms.s5.p2a": string;
  "legal.terms.s5.p2b": string;
  "legal.terms.s5.p2c": string;
  "legal.terms.s5.p2d": string;
  "legal.terms.s5.p3": string;
  "legal.terms.s5.p4": string;
  "legal.terms.s5.p5": string;
  "legal.terms.s6.title": string;
  "legal.terms.s6.p1": string;
  "legal.terms.s6.p2": string;
  "legal.terms.s6.p3": string;
  "legal.terms.s7.title": string;
  "legal.terms.s7.p1": string;
  "legal.terms.s7.p2": string;
  "legal.terms.s8.title": string;
  "legal.terms.s8.p1": string;
  "legal.terms.s8.p2": string;

  // Privacy
  "legal.priv.heading": string;
  "legal.priv.s1.title": string;
  "legal.priv.s1.p1": string;
  "legal.priv.s2.title": string;
  "legal.priv.s2.p1": string;
  "legal.priv.s3.title": string;
  "legal.priv.s3.p1": string;
  "legal.priv.s4.title": string;
  "legal.priv.s4.p1": string;
  "legal.priv.s5.title": string;
  "legal.priv.s5.p1": string;
  "legal.priv.s6.title": string;
  "legal.priv.s6.p1": string;
  "legal.priv.s7.title": string;
  "legal.priv.s7.p1": string;
  "legal.priv.s8.title": string;
  "legal.priv.s8.p1": string;

  // Copyright
  "legal.copy.heading": string;
  "legal.copy.legalBadge": string;
  "legal.copy.legalBadgeDesc": string;
  "legal.copy.sources.title": string;
  "legal.copy.sources.cc": string;
  "legal.copy.sources.youtube": string;
  "legal.copy.sources.user": string;
  "legal.copy.sources.spotify": string;
  "legal.copy.sources.ai": string;
  "legal.copy.dmca.title": string;
  "legal.copy.dmca.p1": string;
  "legal.copy.dmca.p2": string;
  "legal.copy.dmca.p3": string;
  "legal.copy.bases.title": string;
  "legal.copy.bases.infosoc": string;
  "legal.copy.bases.dsm": string;
  "legal.copy.bases.dmca": string;
  "legal.copy.bases.auteurswet": string;
  "legal.copy.bases.youtube": string;
  "legal.copy.bases.spotify": string;
  "legal.copy.bases.suno": string;
  "legal.copy.bases.euipo": string;

  // Cookies
  "legal.cook.heading": string;
  "legal.cook.s1.title": string;
  "legal.cook.s1.p1": string;
  "legal.cook.s2.title": string;
  "legal.cook.s2.essential": string;
  "legal.cook.s2.functional": string;
  "legal.cook.s2.analytical": string;
  "legal.cook.s3.title": string;
  "legal.cook.s3.p1": string;
  "legal.cook.s4.title": string;
  "legal.cook.s4.p1": string;

  // GDPR
  "legal.gdpr.heading": string;
  "legal.gdpr.subheading": string;
  "legal.gdpr.badge": string;
  "legal.gdpr.badgeDesc": string;
  "legal.gdpr.rights.title": string;
  "legal.gdpr.rights.access": string;
  "legal.gdpr.rights.accessDesc": string;
  "legal.gdpr.rights.rectification": string;
  "legal.gdpr.rights.rectificationDesc": string;
  "legal.gdpr.rights.erasure": string;
  "legal.gdpr.rights.erasureDesc": string;
  "legal.gdpr.rights.restriction": string;
  "legal.gdpr.rights.restrictionDesc": string;
  "legal.gdpr.rights.portability": string;
  "legal.gdpr.rights.portabilityDesc": string;
  "legal.gdpr.rights.objection": string;
  "legal.gdpr.rights.objectionDesc": string;
  "legal.gdpr.biometric.title": string;
  "legal.gdpr.biometric.p1": string;
  "legal.gdpr.authority.title": string;
  "legal.gdpr.authority.p1": string;
  "legal.gdpr.authority.p2": string;
  "legal.gdpr.authority.p3": string;
  "legal.gdpr.dpo.title": string;
  "legal.gdpr.dpo.p1": string;
  "legal.gdpr.dpo.p2": string;

  // Upgrade Modal
  "upgrade.title": string;
  "upgrade.subtitle": string;
  "upgrade.popular": string;
  "upgrade.forever": string;
  "upgrade.perMonth": string;
  "upgrade.free.name": string;
  "upgrade.free.f1": string;
  "upgrade.free.f2": string;
  "upgrade.free.f3": string;
  "upgrade.free.f4": string;
  "upgrade.pro.name": string;
  "upgrade.pro.f1": string;
  "upgrade.pro.f2": string;
  "upgrade.pro.f3": string;
  "upgrade.pro.f4": string;
  "upgrade.pro.f5": string;
  "upgrade.pro.f6": string;
  "upgrade.ultimate.name": string;
  "upgrade.ultimate.f1": string;
  "upgrade.ultimate.f2": string;
  "upgrade.ultimate.f3": string;
  "upgrade.ultimate.f4": string;
  "upgrade.ultimate.f5": string;
  "upgrade.ultimate.f6": string;
  "upgrade.ultimate.f7": string;
  "upgrade.currentPlan": string;
  "upgrade.upgradeTo": string;
  "upgrade.processing": string;
  "upgrade.footer": string;
  "upgrade.alreadyFree": string;
  "upgrade.welcomeMsg": string;

  // Mood Detection (QuickMoodDetector)
  "moodDet.title": string;
  "moodDet.subtitle": string;
  "moodDet.loadingModels": string;
  "moodDet.loadingWait": string;
  "moodDet.tfReady": string;
  "moodDet.deepAnalyzing": string;
  "moodDet.analyzing": string;
  "moodDet.initTf": string;
  "moodDet.detectingFace": string;
  "moodDet.analyzingExpression": string;
  "moodDet.recognizingEmotions": string;
  "moodDet.finalizing": string;
  "moodDet.noFace": string;
  "moodDet.noFaceHint": string;
  "moodDet.tryAgain": string;
  "moodDet.cameraActive": string;
  "moodDet.noCameraAccess": string;
  "moodDet.analyzeBtn": string;
  "moodDet.loadingAI": string;
  "moodDet.starting": string;
  "moodDet.cancel": string;
  "moodDet.scanAgain": string;
  "moodDet.confidence": string;
  "moodDet.diagnosisTitle": string;
  "moodDet.emotionalStateTitle": string;
  "moodDet.riskTitle": string;
  "moodDet.fullAnalysis": string;
  "moodDet.collapse": string;
  "moodDet.microExpressions": string;
  "moodDet.psychInsight": string;
  "moodDet.therapeuticAdvice": string;
  "moodDet.musicTherapy": string;
  "moodDet.healingFreq": string;
  "moodDet.playing5tracks": string;
  "moodDet.boostGuarantee": string;
  "moodDet.goalLabel": string;
  "moodDet.noTracks": string;
  "moodDet.trackError": string;
  "moodDet.faceError": string;
  "moodDet.analysisError": string;
  "moodDet.microStep": string;
  "moodDet.diagStep": string;
  "moodDet.therapyStep": string;
  "moodDet.selectionStep": string;
  "moodDet.professorAnalyzing": string;
  "moodDet.happy": string;
  "moodDet.melancholic": string;
  "moodDet.intense": string;
  "moodDet.anxious": string;
  "moodDet.rebellious": string;
  "moodDet.excited": string;
  "moodDet.relaxed": string;
  "moodDet.energetic": string;
  "moodDet.romantic": string;
  "moodDet.focused": string;
  "moodDet.happyDesc": string;
  "moodDet.sadDesc": string;
  "moodDet.angryDesc": string;
  "moodDet.fearfulDesc": string;
  "moodDet.disgustedDesc": string;
  "moodDet.surprisedDesc": string;
  "moodDet.neutralDesc": string;
  "moodDet.energeticDesc": string;
  "moodDet.romanticDesc": string;
  "moodDet.focusedDesc": string;
  "moodDet.aiDescription": string;
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
  "nav.sunoAI": "GrouAI Studio",
  "nav.localPlayer": "Lokalny Player",
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
  "library.startingPopulate": "Rozpoczynam wypełnianie biblioteki...",
  "library.batchFetching": "pobieram utwory...",
  "library.batchAdded": "dodano",
  "library.goalReached": "Cel osiągnięty!",
  "library.donePopulated": "Gotowe! Biblioteka wypełniona.",
  "library.populatedSuccess": "Biblioteka wypełniona!",
  "library.populateError": "Błąd podczas wypełniania",
  "library.pasteTokenError": "Wklej token Spotify!",
  "library.fetchingSpotify": "Pobieram utwory ze Spotify...",
  "library.spotifyDone": "Gotowe! Pobrano",
  "library.spotifyAddedSuccess": "Dodano utworów ze Spotify",
  "library.spotifyImportError": "Błąd importu",
  "library.spotifyImportErrorMsg": "Błąd importu ze Spotify.",
  "library.genreCatalogs": "Katalogi gatunków",
  "library.aiSortsAuto": "AI sortuje automatycznie",
  "library.tracks": "utworów",
  "library.playAll": "Odtwórz wszystkie",
  "library.deleteCatalog": "Usuń katalog",
  "library.play": "Odtwórz",
  "library.noTracksInCatalog": "Brak utworów w tym katalogu",
  "library.catalogDeleted": "Usunięto katalog",
  "library.catalogEmpty": "Katalog jest już pusty",

  "liked.title": "Polubione Utwory",
  "liked.playlist": "Playlista",
  "liked.songs": "utworów",
  "liked.play": "Odtwórz",
  "liked.shuffle": "Losowo",
  "liked.empty": "Brak polubionych utworów. Zacznij przeglądać i polub kilka utworów!",

  "radio.openFullPlayer": "Otwórz pełny player",
  "radio.backHome": "Strona główna",
  "radio.nowPlaying": "Teraz gra",
  "radio.live": "NA ŻYWO",
  "radio.stationOff": "Stacja jest obecnie wyłączona",
  "radio.broadcasting": "Nadawanie",
  "radio.upNext": "Następne w programie",
  "radio.poweredBy": "Powered by GrouAI Stream",
  "radio.loginToLike": "Zaloguj się",
  "radio.loginToLikeDesc": "Aby polubić utwór, musisz się zalogować.",
  "radio.unliked": "💔 Usunięto z polubionych",
  "radio.liked": "❤️ Polubiono!",
  "radio.likedDesc": "dodano do pamięci AI",
  "radio.likesCount": "polubień",
  "radio.wishes": "Życzenia",
  "radio.wishesTitle": "💬 Życzenia słuchaczy",
  "radio.wishPlaceholder": "Napisz życzenie, pozdrowienie...",
  "radio.sendWish": "Wyślij",
  "radio.loginToChat": "Zaloguj się aby pisać życzenia",
  "radio.deleteWish": "Usuń życzenie",
  "radio.noWishes": "Bądź pierwszy! Napisz życzenie 🎵",

  "widget.micTooltip": "Asystent głosowy — mów do AI",
  "widget.chatTooltip": "Czat z AI — pisz i pytaj o wszystko",

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
  "legal.lastUpdate": "Ostatnia aktualizacja: 28 lutego 2026 r.",

  // Terms content
  "legal.terms.heading": "Regulamin korzystania z serwisu GrouAI Stream",
  "legal.terms.s1.title": "§1. Postanowienia ogólne",
  "legal.terms.s1.p1": "1. Niniejszy Regulamin określa zasady korzystania z platformy muzycznej GrouAI Stream (dalej: \"Serwis\").",
  "legal.terms.s1.p2": "2. Serwis jest prowadzony przez GrouaRock — projekt w fazie przedrejestracyjnej, z planowaną siedzibą w Holandii. Rejestracja w Izbie Handlowej (Kamer van Koophandel, KvK) nastąpi po osiągnięciu wystarczającej bazy użytkowników. Do tego momentu Serwis działa jako projekt indywidualny na zasadach eenmanszaak (jednoosobowa działalność gospodarcza wg prawa holenderskiego).",
  "legal.terms.s1.p3": "3. Korzystanie z Serwisu oznacza akceptację niniejszego Regulaminu oraz Polityki Prywatności.",
  "legal.terms.s2.title": "§2. Status prawny i rejestracja",
  "legal.terms.s2.badge": "📋 Informacja o statusie rejestracyjnym",
  "legal.terms.s2.badgeDesc": "GrouaRock znajduje się obecnie w fazie rozwojowej (pre-launch). Formalna rejestracja w KvK oraz uzyskanie numeru BTW (VAT) nastąpi zgodnie z holenderskim prawem handlowym po spełnieniu progów rejestracyjnych, uzależnionych od liczby aktywnych użytkowników i obrotów.",
  "legal.terms.s2.p1": "1. Niniejszy Regulamin stanowi wiążącą umowę pomiędzy użytkownikiem a operatorem Serwisu, niezależnie od statusu rejestracyjnego podmiotu.",
  "legal.terms.s2.p2": "2. Operator zobowiązuje się do formalnej rejestracji działalności gospodarczej w KvK po osiągnięciu progu 500 aktywnych użytkowników lub 10 000 EUR rocznego obrotu — zgodnie z wymogami prawa holenderskiego.",
  "legal.terms.s2.p3": "3. Regulamin, Polityka Prywatności oraz pozostałe dokumenty prawne będą aktualizowane wraz z postępem rejestracji. O każdej istotnej zmianie użytkownicy zostaną poinformowani z co najmniej 14-dniowym wyprzedzeniem drogą mailową.",
  "legal.terms.s2.p4": "4. Do momentu formalnej rejestracji, operator ponosi pełną odpowiedzialność osobistą za działanie Serwisu zgodnie z art. 6:162 Burgerlijk Wetboek (holenderski kodeks cywilny).",
  "legal.terms.s3.title": "§3. Usługi",
  "legal.terms.s3.p1": "1. Serwis umożliwia: odtwarzanie muzyki z legalnych źródeł, tworzenie playlist, korzystanie z rekomendacji AI, import metadanych muzycznych.",
  "legal.terms.s3.p2": "2. Wszystkie treści udostępniane w Serwisie pochodzą z legalnych źródeł, w tym: utwory na licencji Creative Commons (CC Mixter), materiały przesłane przez użytkowników z odpowiednimi prawami, oraz osadzone treści z YouTube zgodnie z YouTube API Terms of Service.",
  "legal.terms.s3.p3": "3. Serwis nie przechowuje ani nie dystrybuuje nielegalnych kopii utworów chronionych prawem autorskim.",
  "legal.terms.s4.title": "§4. Konto użytkownika",
  "legal.terms.s4.p1": "1. Rejestracja wymaga podania adresu e-mail i hasła.",
  "legal.terms.s4.p2": "2. Użytkownik jest odpowiedzialny za bezpieczeństwo swojego konta.",
  "legal.terms.s4.p3": "3. Konta mogą zostać zawieszone w przypadku naruszenia Regulaminu.",
  "legal.terms.s5.title": "§5. Utwory generowane przez AI (Suno i inne)",
  "legal.terms.s5.p1": "1. GrouAI Stream umożliwia wprowadzanie utworów wygenerowanych za pomocą narzędzi AI, takich jak Suno, Udio, AIVA i inne platformy generatywne.",
  "legal.terms.s5.p2": "2. Użytkownik przesyłający utwór wygenerowany przez AI oświadcza, że:",
  "legal.terms.s5.p2a": "a) utwór został stworzony indywidualnie na jego koncie w danym serwisie AI,",
  "legal.terms.s5.p2b": "b) posiada prawo do dystrybucji utworu zgodnie z warunkami licencji platformy generatywnej (np. Suno Pro/Premier umożliwia komercyjne wykorzystanie),",
  "legal.terms.s5.p2c": "c) udziela GrouAI Stream wyłącznej, bezterminowej licencji na odtwarzanie, udostępnianie i przetwarzanie utworu w ramach Serwisu,",
  "legal.terms.s5.p2d": "d) utwór nie narusza praw autorskich osób trzecich, nie jest plagiatem ani kopią istniejącego chronionego utworu.",
  "legal.terms.s5.p3": "3. Zgodnie z obecnym stanem prawnym UE (stanowisko EUIPO oraz Dyrektywa DSM 2019/790), utwory w pełni wygenerowane przez AI nie podlegają ochronie prawnoautorskiej w tradycyjnym rozumieniu, gdyż brak jest ludzkiego twórcy. Jednakże użytkownik, który dokonał twórczego wkładu (prompt engineering, aranżacja, selekcja, modyfikacja), może posiadać prawa pokrewne do rezultatu.",
  "legal.terms.s5.p4": "4. GrouAI Stream nie rości sobie praw autorskich do utworów wygenerowanych przez AI — prawa pozostają po stronie osoby, która je przesłała i udzieliła licencji.",
  "legal.terms.s5.p5": "5. W przypadku sporu dotyczącego praw do utworu AI, stosuje się procedurę DMCA/NTD opisaną w §6.",
  "legal.terms.s6.title": "§6. Ograniczenie odpowiedzialności",
  "legal.terms.s6.p1": "1. Serwis jest udostępniany \"tak jak jest\" (as-is). Nie gwarantujemy nieprzerwanej dostępności.",
  "legal.terms.s6.p2": "2. Nie ponosimy odpowiedzialności za treści przesłane przez użytkowników.",
  "legal.terms.s6.p3": "3. Zastrzegamy prawo do usunięcia treści naruszających prawa autorskie na podstawie zgłoszeń DMCA/NTD.",
  "legal.terms.s7.title": "§7. Prawo właściwe",
  "legal.terms.s7.p1": "1. Regulamin podlega prawu holenderskiemu.",
  "legal.terms.s7.p2": "2. Spory rozstrzygane są przez sąd właściwy dla siedziby operatora lub jego miejsca zamieszkania (do czasu formalnej rejestracji).",
  "legal.terms.s8.title": "§8. Zmiany Regulaminu",
  "legal.terms.s8.p1": "1. Operator zastrzega sobie prawo do zmiany niniejszego Regulaminu w związku ze zmianą statusu rejestracyjnego, rozwojem funkcjonalności Serwisu lub zmianami prawnymi.",
  "legal.terms.s8.p2": "2. O zmianach użytkownicy zostaną powiadomieni z 14-dniowym wyprzedzeniem. Dalsze korzystanie z Serwisu po tym terminie oznacza akceptację zmian.",

  // Privacy
  "legal.priv.heading": "Polityka Prywatności",
  "legal.priv.s1.title": "1. Administrator danych",
  "legal.priv.s1.p1": "Administratorem danych osobowych jest GrouaRock, Holandia. Kontakt: privacy@grouai.stream",
  "legal.priv.s2.title": "2. Zakres zbieranych danych",
  "legal.priv.s2.p1": "Zbieramy następujące dane: adres e-mail (rejestracja), nazwę wyświetlaną (opcjonalnie), historię słuchania (za zgodą), preferencje nastrojowe (za zgodą), dane biometryczne z kamery/mikrofonu (wyłącznie za wyraźną zgodą użytkownika).",
  "legal.priv.s3.title": "3. Cel przetwarzania danych",
  "legal.priv.s3.p1": "Dane są przetwarzane w celu: świadczenia usług platformy, personalizacji rekomendacji muzycznych AI, analizy nastrojów (opcjonalnie), poprawy jakości usług.",
  "legal.priv.s4.title": "4. Podstawa prawna",
  "legal.priv.s4.p1": "Przetwarzanie odbywa się na podstawie: zgody użytkownika (art. 6 ust. 1 lit. a RODO), wykonania umowy (art. 6 ust. 1 lit. b RODO), prawnie uzasadnionego interesu administratora (art. 6 ust. 1 lit. f RODO).",
  "legal.priv.s5.title": "5. Okres przechowywania",
  "legal.priv.s5.p1": "Dane są przechowywane przez okres korzystania z konta. Po usunięciu konta wszystkie dane osobowe są usuwane w ciągu 30 dni.",
  "legal.priv.s6.title": "6. Prawa użytkownika",
  "legal.priv.s6.p1": "Każdy użytkownik ma prawo do: dostępu do swoich danych, sprostowania danych, usunięcia danych (\"prawo do bycia zapomnianym\"), ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu, cofnięcia zgody w dowolnym momencie.",
  "legal.priv.s7.title": "7. Bezpieczeństwo",
  "legal.priv.s7.p1": "Stosujemy szyfrowanie TLS/SSL, bezpieczne przechowywanie haseł (bcrypt), anonimizację danych analitycznych, regularne audyty bezpieczeństwa.",
  "legal.priv.s8.title": "8. Przekazywanie danych",
  "legal.priv.s8.p1": "Dane mogą być przekazywane do podmiotów trzecich wyłącznie w celu realizacji usług (np. hosting, analityka), na podstawie odpowiednich umów powierzenia przetwarzania danych, zgodnie ze Standardowymi Klauzulami Umownymi (SCC).",

  // Copyright
  "legal.copy.heading": "Polityka praw autorskich i licencji",
  "legal.copy.legalBadge": "Oświadczenie o legalności",
  "legal.copy.legalBadgeDesc": "GrouAI Stream działa w pełni zgodnie z prawem. Wszystkie treści muzyczne pochodzą z legalnych źródeł i są udostępniane na podstawie odpowiednich licencji lub w ramach dozwolonego użytku.",
  "legal.copy.sources.title": "Źródła treści muzycznych",
  "legal.copy.sources.cc": "1. Creative Commons (CC Mixter) — Główne źródło treści. Utwory udostępniane na licencjach CC (BY, BY-NC, BY-SA, BY-NC-SA). Każdy utwór posiada wyświetlaną atrybucję zgodnie z wymogami licencji.",
  "legal.copy.sources.youtube": "2. YouTube Embed (IFrame API) — Osadzanie treści z YouTube odbywa się wyłącznie poprzez oficjalne YouTube IFrame Player API. Jest to zgodne z YouTube Terms of Service (Sekcja 6.B). Nie pobieramy, nie kopiujemy ani nie przechowujemy treści wideo/audio z YouTube.",
  "legal.copy.sources.user": "3. Treści przesłane przez użytkowników — Użytkownicy mogą przesyłać wyłącznie utwory, do których posiadają prawa autorskie lub odpowiednią licencję. W przypadku zgłoszenia naruszenia stosujemy procedurę DMCA/Notice-and-Takedown.",
  "legal.copy.sources.spotify": "4. Import metadanych (Spotify API) — Importujemy wyłącznie metadane (tytuł, artysta, album, okładka) za pośrednictwem oficjalnego Spotify Web API. Nie pobieramy ani nie odtwarzamy plików audio ze Spotify. Import odbywa się za zgodą użytkownika poprzez OAuth 2.0.",
  "legal.copy.sources.ai": "5. Utwory AI (Suno, Udio, AIVA i inne) — Utwory wygenerowane przez platformy AI i przesłane przez użytkowników z odpowiednią licencją (np. Suno Pro/Premier). Użytkownik udziela GrouAI Stream wyłącznej licencji na odtwarzanie i udostępnianie. Utwory AI nie naruszają praw autorskich osób trzecich, gdyż są generowane algorytmicznie na indywidualne zamówienie użytkownika. Zgodnie ze stanowiskiem EUIPO i holenderskim Auteurswet, twórczy wkład użytkownika (prompt, selekcja, modyfikacja) może stanowić podstawę praw pokrewnych.",
  "legal.copy.dmca.title": "Procedura zgłaszania naruszeń (DMCA/NTD)",
  "legal.copy.dmca.p1": "Jeśli uważasz, że Twoje prawa autorskie zostały naruszone, skontaktuj się z nami: dmca@grouai.stream",
  "legal.copy.dmca.p2": "Zgłoszenie powinno zawierać: identyfikację chronionego utworu, wskazanie lokalizacji naruszenia w Serwisie, dane kontaktowe zgłaszającego, oświadczenie o dobrej wierze.",
  "legal.copy.dmca.p3": "Zobowiązujemy się do rozpatrzenia zgłoszenia w ciągu 48 godzin roboczych.",
  "legal.copy.bases.title": "Podstawy prawne",
  "legal.copy.bases.infosoc": "• Dyrektywa 2001/29/WE (InfoSoc) — dozwolony użytek, osadzanie treści",
  "legal.copy.bases.dsm": "• Dyrektywa 2019/790 (DSM) — art. 17, odpowiedzialność platform",
  "legal.copy.bases.dmca": "• DMCA (Digital Millennium Copyright Act) — procedura Notice-and-Takedown",
  "legal.copy.bases.auteurswet": "• Ustawa o prawie autorskim i prawach pokrewnych (Auteurswet, Holandia)",
  "legal.copy.bases.youtube": "• YouTube API Terms of Service — zasady osadzania",
  "legal.copy.bases.spotify": "• Spotify Developer Terms of Service — zasady korzystania z API",
  "legal.copy.bases.suno": "• Suno Terms of Service — licencja na komercyjne użycie utworów AI (plany Pro/Premier)",
  "legal.copy.bases.euipo": "• Stanowisko EUIPO ws. AI-generated content — status prawnoautorski treści generowanych przez AI",

  // Cookies
  "legal.cook.heading": "Polityka cookies",
  "legal.cook.s1.title": "1. Czym są pliki cookies?",
  "legal.cook.s1.p1": "Pliki cookies to małe pliki tekstowe przechowywane w przeglądarce użytkownika.",
  "legal.cook.s2.title": "2. Jakie cookies stosujemy?",
  "legal.cook.s2.essential": "Niezbędne — wymagane do działania Serwisu (sesja logowania, preferencje). Podstawa: art. 6 ust. 1 lit. f RODO.",
  "legal.cook.s2.functional": "Funkcjonalne — zapamiętywanie ustawień (np. głośność, tryb ciemny). Podstawa: zgoda użytkownika.",
  "legal.cook.s2.analytical": "Analityczne — anonimowa analiza użytkowania (nie stosujemy Google Analytics ani trackerów reklamowych). Podstawa: zgoda użytkownika.",
  "legal.cook.s3.title": "3. Cookies podmiotów trzecich",
  "legal.cook.s3.p1": "Osadzone treści YouTube mogą ustawiać własne cookies zgodnie z polityką Google. Szczegóły: policies.google.com/privacy",
  "legal.cook.s4.title": "4. Zarządzanie cookies",
  "legal.cook.s4.p1": "Użytkownik może w każdej chwili usunąć lub zablokować cookies w ustawieniach przeglądarki. Zablokowanie cookies niezbędnych może ograniczyć funkcjonalność Serwisu.",

  // GDPR
  "legal.gdpr.heading": "Informacja o przetwarzaniu danych osobowych (RODO)",
  "legal.gdpr.subheading": "Zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r.",
  "legal.gdpr.badge": "✅ Pełna zgodność z RODO",
  "legal.gdpr.badgeDesc": "GrouAI Stream przetwarza dane osobowe wyłącznie zgodnie z RODO. Jako firma z siedzibą w Holandii (UE), podlegamy bezpośrednio pod europejskie przepisy o ochronie danych osobowych.",
  "legal.gdpr.rights.title": "Twoje prawa (art. 15-22 RODO)",
  "legal.gdpr.rights.access": "Prawo dostępu",
  "legal.gdpr.rights.accessDesc": "Możesz zażądać kopii swoich danych",
  "legal.gdpr.rights.rectification": "Prawo do sprostowania",
  "legal.gdpr.rights.rectificationDesc": "Możesz poprawić nieprawidłowe dane",
  "legal.gdpr.rights.erasure": "Prawo do usunięcia",
  "legal.gdpr.rights.erasureDesc": "Prawo do bycia zapomnianym",
  "legal.gdpr.rights.restriction": "Prawo do ograniczenia",
  "legal.gdpr.rights.restrictionDesc": "Ograniczenie przetwarzania danych",
  "legal.gdpr.rights.portability": "Prawo do przenoszenia",
  "legal.gdpr.rights.portabilityDesc": "Eksport danych w formacie CSV/JSON",
  "legal.gdpr.rights.objection": "Prawo do sprzeciwu",
  "legal.gdpr.rights.objectionDesc": "Sprzeciw wobec przetwarzania",
  "legal.gdpr.biometric.title": "Dane biometryczne (art. 9 RODO)",
  "legal.gdpr.biometric.p1": "Funkcje analizy twarzy (wykrywanie nastrojów) i analizy głosu są domyślnie wyłączone. Aktywacja wymaga wyraźnej zgody użytkownika. Dane biometryczne są przetwarzane lokalnie w przeglądarce i nie są przesyłane na serwer. Użytkownik może cofnąć zgodę w każdym momencie w Ustawieniach → AI & Prywatność.",
  "legal.gdpr.authority.title": "Organ nadzorczy",
  "legal.gdpr.authority.p1": "Autoriteit Persoonsgegevens (AP) — Holenderski Urząd Ochrony Danych Osobowych",
  "legal.gdpr.authority.p2": "www.autoriteitpersoonsgegevens.nl",
  "legal.gdpr.authority.p3": "Każdy użytkownik ma prawo złożyć skargę do organu nadzorczego.",
  "legal.gdpr.dpo.title": "Kontakt z Inspektorem Ochrony Danych",
  "legal.gdpr.dpo.p1": "E-mail: dpo@grouai.stream",
  "legal.gdpr.dpo.p2": "Odpowiadamy na zapytania w ciągu 30 dni kalendarzowych, zgodnie z art. 12 ust. 3 RODO.",

  "upgrade.title": "Ulepsz GrouAI Stream",
  "upgrade.subtitle": "Odblokuj pełen potencjał AI muzyki",
  "upgrade.popular": "POPULARNE",
  "upgrade.forever": "na zawsze",
  "upgrade.perMonth": "/mies.",
  "upgrade.free.name": "Darmowy",
  "upgrade.free.f1": "Podstawowe słuchanie",
  "upgrade.free.f2": "Ograniczone pomijanie",
  "upgrade.free.f3": "Reklamy między utworami",
  "upgrade.free.f4": "Standardowa jakość",
  "upgrade.pro.name": "Pro",
  "upgrade.pro.f1": "Nieograniczone słuchanie",
  "upgrade.pro.f2": "Bez reklam",
  "upgrade.pro.f3": "Wysoka jakość (320kbps)",
  "upgrade.pro.f4": "AI DJ i Detekcja Nastroju",
  "upgrade.pro.f5": "Pobieranie offline",
  "upgrade.pro.f6": "5 playlist AI dziennie",
  "upgrade.ultimate.name": "Ultimate",
  "upgrade.ultimate.f1": "Wszystko z Pro",
  "upgrade.ultimate.f2": "Bezstratne audio (FLAC)",
  "upgrade.ultimate.f3": "Nieograniczone playlisty AI",
  "upgrade.ultimate.f4": "Raporty AI Psychologa",
  "upgrade.ultimate.f5": "Priorytetowe wsparcie",
  "upgrade.ultimate.f6": "Wczesny dostęp do funkcji",
  "upgrade.ultimate.f7": "Własna osobowość AI DJ",
  "upgrade.currentPlan": "Aktualny Plan",
  "upgrade.upgradeTo": "Ulepsz do",
  "upgrade.processing": "Przetwarzanie...",
  "upgrade.footer": "Anuluj w każdej chwili • 7-dniowy darmowy okres • Bez karty kredytowej",
  "upgrade.alreadyFree": "Już masz plan Darmowy!",
  "upgrade.welcomeMsg": "🎉 Witaj w GrouAI {plan}! Ciesz się funkcjami premium.",

  "moodDet.title": "AI Profesor Psychologii",
  "moodDet.subtitle": "TensorFlow.js + AI gotowy",
  "moodDet.loadingModels": "Ładowanie modeli face-api.js...",
  "moodDet.loadingWait": "To może potrwać kilka sekund",
  "moodDet.tfReady": "TensorFlow.js gotowy",
  "moodDet.deepAnalyzing": "Głęboka analiza psychiatryczna...",
  "moodDet.analyzing": "Analizuję...",
  "moodDet.initTf": "Inicjalizacja TensorFlow.js...",
  "moodDet.detectingFace": "Wykrywanie twarzy...",
  "moodDet.analyzingExpression": "Analiza wyrazu twarzy...",
  "moodDet.recognizingEmotions": "Rozpoznawanie emocji...",
  "moodDet.finalizing": "Finalizacja wyników...",
  "moodDet.noFace": "Nie wykryto twarzy",
  "moodDet.noFaceHint": "Upewnij się, że twarz jest dobrze oświetlona",
  "moodDet.tryAgain": "Spróbuj ponownie",
  "moodDet.cameraActive": "🎥 Kamera aktywna! Analizuję twarz przez 5 sekund...",
  "moodDet.noCameraAccess": "Brak dostępu do kamery. Sprawdź uprawnienia.",
  "moodDet.analyzeBtn": "Analizuj emocje (5s)",
  "moodDet.loadingAI": "Ładowanie AI...",
  "moodDet.starting": "Uruchamiam...",
  "moodDet.cancel": "Anuluj",
  "moodDet.scanAgain": "Skanuj ponownie",
  "moodDet.confidence": "pewności detekcji",
  "moodDet.diagnosisTitle": "Diagnoza Profesora",
  "moodDet.emotionalStateTitle": "Stan Emocjonalny",
  "moodDet.riskTitle": "Poziom Ryzyka",
  "moodDet.fullAnalysis": "Pełna analiza psychiatryczna",
  "moodDet.collapse": "Zwiń",
  "moodDet.microExpressions": "Mikroekspresje",
  "moodDet.psychInsight": "Wgląd Psychologiczny",
  "moodDet.therapeuticAdvice": "Zalecenia Terapeutyczne",
  "moodDet.musicTherapy": "Muzykoterapia",
  "moodDet.healingFreq": "Częstotliwość Lecznicza",
  "moodDet.playing5tracks": "Gram 5 utworów dobranych przez AI Profesora",
  "moodDet.boostGuarantee": "Humor +100% gwarantowany!",
  "moodDet.goalLabel": "Cel",
  "moodDet.noTracks": "Brak utworów w bazie.",
  "moodDet.trackError": "Błąd podczas ładowania utworów.",
  "moodDet.faceError": "Błąd podczas analizy twarzy. Spróbuj ponownie.",
  "moodDet.analysisError": "Nie udało się przeprowadzić głębokiej analizy AI.",
  "moodDet.microStep": "Analiza mikroekspresji...",
  "moodDet.diagStep": "Diagnoza psychiatryczna...",
  "moodDet.therapyStep": "Dobór muzykoterapii...",
  "moodDet.selectionStep": "Selekcja 5 utworów...",
  "moodDet.professorAnalyzing": "🧠 Profesor AI analizuje Twój stan...",
  "moodDet.happy": "Szczęśliwy",
  "moodDet.melancholic": "Melancholijny",
  "moodDet.intense": "Intensywny",
  "moodDet.anxious": "Niespokojny",
  "moodDet.rebellious": "Buntowniczy",
  "moodDet.excited": "Podekscytowany",
  "moodDet.relaxed": "Zrelaksowany",
  "moodDet.energetic": "Energetyczny",
  "moodDet.romantic": "Romantyczny",
  "moodDet.focused": "Skupiony",
  "moodDet.happyDesc": "Masz świetny dzień! Energia pozytywna promieniuje z Ciebie!",
  "moodDet.sadDesc": "Wygląda na trudniejszy dzień... Muzyka poprawi Ci nastrój!",
  "moodDet.angryDesc": "Czujesz się intensywnie! Czas na muzykę, która to uwolni!",
  "moodDet.fearfulDesc": "Stresujący dzień? Uspokajające dźwięki pomogą!",
  "moodDet.disgustedDesc": "Buntowniczy nastrój! Rock i punk dla Ciebie!",
  "moodDet.surprisedDesc": "Pełen ekscytacji dzień! Czas na energetyczną muzykę!",
  "moodDet.neutralDesc": "Spokojny, zrelaksowany dzień. Idealna pora na chill!",
  "moodDet.energeticDesc": "WOW! Mega energetyczny dzień! Czas rozkręcić imprezę!",
  "moodDet.romanticDesc": "Romantyczny nastrój... Czas na piękne melodie!",
  "moodDet.focusedDesc": "Skupiony i gotowy do działania! Muzyka pomoże!",
  "moodDet.aiDescription": "AI Profesor przeanalizuje Twoje emocje i dobierze 5 idealnych utworów",
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
  "nav.sunoAI": "GrouAI Studio",
  "nav.localPlayer": "Local Player",
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
  "library.startingPopulate": "Starting library population...",
  "library.batchFetching": "fetching tracks...",
  "library.batchAdded": "added",
  "library.goalReached": "Goal reached!",
  "library.donePopulated": "Done! Library populated.",
  "library.populatedSuccess": "Library populated!",
  "library.populateError": "Error during population",
  "library.pasteTokenError": "Paste Spotify token!",
  "library.fetchingSpotify": "Fetching tracks from Spotify...",
  "library.spotifyDone": "Done! Fetched",
  "library.spotifyAddedSuccess": "tracks added from Spotify",
  "library.spotifyImportError": "Import error",
  "library.spotifyImportErrorMsg": "Spotify import error.",
  "library.genreCatalogs": "Genre Catalogs",
  "library.aiSortsAuto": "AI sorts automatically",
  "library.tracks": "tracks",
  "library.playAll": "Play all",
  "library.deleteCatalog": "Delete catalog",
  "library.play": "Play",
  "library.noTracksInCatalog": "No tracks in this catalog",
  "library.catalogDeleted": "Catalog deleted",
  "library.catalogEmpty": "Catalog is already empty",

  "liked.title": "Liked Songs",
  "liked.playlist": "Playlist",
  "liked.songs": "songs",
  "liked.play": "Play",
  "liked.shuffle": "Shuffle",
  "liked.empty": "No liked songs yet. Start exploring and like some tracks!",

  "radio.openFullPlayer": "Open full player",
  "radio.backHome": "Home",
  "radio.nowPlaying": "Now playing",
  "radio.live": "LIVE",
  "radio.stationOff": "Station is currently off air",
  "radio.broadcasting": "Broadcasting",
  "radio.upNext": "Up next",
  "radio.poweredBy": "Powered by GrouAI Stream",
  "radio.loginToLike": "Log in",
  "radio.loginToLikeDesc": "You need to log in to like a track.",
  "radio.unliked": "💔 Removed from liked",
  "radio.liked": "❤️ Liked!",
  "radio.likedDesc": "added to AI memory",
  "radio.likesCount": "likes",
  "radio.wishes": "Wishes",
  "radio.wishesTitle": "💬 Listener wishes",
  "radio.wishPlaceholder": "Write a wish, greeting...",
  "radio.sendWish": "Send",
  "radio.loginToChat": "Log in to write wishes",
  "radio.deleteWish": "Delete wish",
  "radio.noWishes": "Be first! Write a wish 🎵",

  "widget.micTooltip": "Voice assistant — talk to AI",
  "widget.chatTooltip": "AI Chat — write and ask anything",

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
  "legal.lastUpdate": "Last updated: February 28, 2026",

  // Terms content
  "legal.terms.heading": "Terms of Service for GrouAI Stream",
  "legal.terms.s1.title": "§1. General Provisions",
  "legal.terms.s1.p1": "1. These Terms of Service define the rules for using the GrouAI Stream music platform (hereinafter: \"Service\").",
  "legal.terms.s1.p2": "2. The Service is operated by GrouaRock — a pre-registration project based in the Netherlands. Registration with the Chamber of Commerce (Kamer van Koophandel, KvK) will take place after achieving a sufficient user base. Until then, the Service operates as a sole proprietorship (eenmanszaak) under Dutch law.",
  "legal.terms.s1.p3": "3. Using the Service constitutes acceptance of these Terms of Service and the Privacy Policy.",
  "legal.terms.s2.title": "§2. Legal Status and Registration",
  "legal.terms.s2.badge": "📋 Registration Status Information",
  "legal.terms.s2.badgeDesc": "GrouaRock is currently in the development phase (pre-launch). Formal registration with KvK and obtaining a BTW (VAT) number will occur in accordance with Dutch commercial law after meeting registration thresholds based on the number of active users and revenue.",
  "legal.terms.s2.p1": "1. These Terms constitute a binding agreement between the user and the Service operator, regardless of the entity's registration status.",
  "legal.terms.s2.p2": "2. The operator commits to formally registering the business with KvK after reaching 500 active users or €10,000 annual revenue — in compliance with Dutch law.",
  "legal.terms.s2.p3": "3. The Terms, Privacy Policy, and other legal documents will be updated as registration progresses. Users will be notified of any significant changes at least 14 days in advance via email.",
  "legal.terms.s2.p4": "4. Until formal registration, the operator bears full personal liability for the Service's operation in accordance with Art. 6:162 of the Dutch Civil Code (Burgerlijk Wetboek).",
  "legal.terms.s3.title": "§3. Services",
  "legal.terms.s3.p1": "1. The Service provides: music playback from legal sources, playlist creation, AI recommendations, and music metadata import.",
  "legal.terms.s3.p2": "2. All content provided through the Service comes from legal sources, including: Creative Commons licensed tracks (CC Mixter), user-uploaded materials with appropriate rights, and embedded YouTube content in accordance with YouTube API Terms of Service.",
  "legal.terms.s3.p3": "3. The Service does not store or distribute illegal copies of copyrighted works.",
  "legal.terms.s4.title": "§4. User Account",
  "legal.terms.s4.p1": "1. Registration requires an email address and password.",
  "legal.terms.s4.p2": "2. The user is responsible for the security of their account.",
  "legal.terms.s4.p3": "3. Accounts may be suspended in case of Terms violation.",
  "legal.terms.s5.title": "§5. AI-Generated Tracks (Suno and others)",
  "legal.terms.s5.p1": "1. GrouAI Stream allows uploading of tracks generated using AI tools such as Suno, Udio, AIVA, and other generative platforms.",
  "legal.terms.s5.p2": "2. A user uploading an AI-generated track declares that:",
  "legal.terms.s5.p2a": "a) the track was individually created on their account in the given AI service,",
  "legal.terms.s5.p2b": "b) they have the right to distribute the track in accordance with the generative platform's license terms (e.g., Suno Pro/Premier allows commercial use),",
  "legal.terms.s5.p2c": "c) they grant GrouAI Stream an exclusive, perpetual license to play, share, and process the track within the Service,",
  "legal.terms.s5.p2d": "d) the track does not infringe third-party copyrights and is not a plagiarism or copy of an existing protected work.",
  "legal.terms.s5.p3": "3. Under current EU law (EUIPO position and DSM Directive 2019/790), fully AI-generated works are not subject to traditional copyright protection due to the absence of a human author. However, a user who made a creative contribution (prompt engineering, arrangement, selection, modification) may hold related rights to the result.",
  "legal.terms.s5.p4": "4. GrouAI Stream does not claim copyright to AI-generated tracks — rights remain with the person who uploaded them and granted the license.",
  "legal.terms.s5.p5": "5. In case of a dispute regarding AI track rights, the DMCA/NTD procedure described in §6 applies.",
  "legal.terms.s6.title": "§6. Limitation of Liability",
  "legal.terms.s6.p1": "1. The Service is provided \"as-is\". We do not guarantee uninterrupted availability.",
  "legal.terms.s6.p2": "2. We are not responsible for content uploaded by users.",
  "legal.terms.s6.p3": "3. We reserve the right to remove content infringing copyrights based on DMCA/NTD reports.",
  "legal.terms.s7.title": "§7. Governing Law",
  "legal.terms.s7.p1": "1. These Terms are governed by Dutch law.",
  "legal.terms.s7.p2": "2. Disputes are resolved by the court competent for the operator's registered office or place of residence (until formal registration).",
  "legal.terms.s8.title": "§8. Changes to Terms",
  "legal.terms.s8.p1": "1. The operator reserves the right to modify these Terms due to changes in registration status, Service functionality development, or legal changes.",
  "legal.terms.s8.p2": "2. Users will be notified of changes 14 days in advance. Continued use of the Service after this period constitutes acceptance of the changes.",

  // Privacy
  "legal.priv.heading": "Privacy Policy",
  "legal.priv.s1.title": "1. Data Controller",
  "legal.priv.s1.p1": "The data controller is GrouaRock, Netherlands. Contact: privacy@grouai.stream",
  "legal.priv.s2.title": "2. Scope of Collected Data",
  "legal.priv.s2.p1": "We collect the following data: email address (registration), display name (optional), listening history (with consent), mood preferences (with consent), biometric data from camera/microphone (only with explicit user consent).",
  "legal.priv.s3.title": "3. Purpose of Data Processing",
  "legal.priv.s3.p1": "Data is processed for: platform service delivery, AI music recommendation personalization, mood analysis (optional), service quality improvement.",
  "legal.priv.s4.title": "4. Legal Basis",
  "legal.priv.s4.p1": "Processing is based on: user consent (Art. 6(1)(a) GDPR), contract performance (Art. 6(1)(b) GDPR), legitimate interest of the controller (Art. 6(1)(f) GDPR).",
  "legal.priv.s5.title": "5. Retention Period",
  "legal.priv.s5.p1": "Data is stored for the duration of account usage. After account deletion, all personal data is removed within 30 days.",
  "legal.priv.s6.title": "6. User Rights",
  "legal.priv.s6.p1": "Every user has the right to: access their data, rectify data, delete data (\"right to be forgotten\"), restrict processing, data portability, object to processing, withdraw consent at any time.",
  "legal.priv.s7.title": "7. Security",
  "legal.priv.s7.p1": "We use TLS/SSL encryption, secure password storage (bcrypt), anonymization of analytical data, regular security audits.",
  "legal.priv.s8.title": "8. Data Transfers",
  "legal.priv.s8.p1": "Data may be transferred to third parties only for service delivery purposes (e.g., hosting, analytics), based on appropriate data processing agreements, in accordance with Standard Contractual Clauses (SCC).",

  // Copyright
  "legal.copy.heading": "Copyright & Licensing Policy",
  "legal.copy.legalBadge": "Legality Statement",
  "legal.copy.legalBadgeDesc": "GrouAI Stream operates in full compliance with the law. All musical content comes from legal sources and is made available under appropriate licenses or fair use.",
  "legal.copy.sources.title": "Music Content Sources",
  "legal.copy.sources.cc": "1. Creative Commons (CC Mixter) — Primary content source. Tracks shared under CC licenses (BY, BY-NC, BY-SA, BY-NC-SA). Each track displays attribution as required by the license.",
  "legal.copy.sources.youtube": "2. YouTube Embed (IFrame API) — YouTube content is embedded exclusively via the official YouTube IFrame Player API. This complies with YouTube Terms of Service (Section 6.B). We do not download, copy, or store video/audio content from YouTube.",
  "legal.copy.sources.user": "3. User-Uploaded Content — Users may only upload tracks to which they hold copyright or appropriate license. In case of infringement reports, we apply the DMCA/Notice-and-Takedown procedure.",
  "legal.copy.sources.spotify": "4. Metadata Import (Spotify API) — We import only metadata (title, artist, album, cover) via the official Spotify Web API. We do not download or play audio files from Spotify. Import occurs with user consent via OAuth 2.0.",
  "legal.copy.sources.ai": "5. AI Tracks (Suno, Udio, AIVA and others) — Tracks generated by AI platforms and uploaded by users with appropriate license (e.g., Suno Pro/Premier). The user grants GrouAI Stream an exclusive license to play and share. AI tracks do not infringe third-party copyrights as they are algorithmically generated on individual user request. Per EUIPO and Dutch Auteurswet, the user's creative contribution (prompt, selection, modification) may form the basis for related rights.",
  "legal.copy.dmca.title": "Infringement Reporting Procedure (DMCA/NTD)",
  "legal.copy.dmca.p1": "If you believe your copyrights have been infringed, contact us: dmca@grouai.stream",
  "legal.copy.dmca.p2": "A report should include: identification of the protected work, location of the infringement in the Service, reporter's contact details, good faith statement.",
  "legal.copy.dmca.p3": "We commit to reviewing reports within 48 business hours.",
  "legal.copy.bases.title": "Legal Bases",
  "legal.copy.bases.infosoc": "• Directive 2001/29/EC (InfoSoc) — fair use, content embedding",
  "legal.copy.bases.dsm": "• Directive 2019/790 (DSM) — Art. 17, platform liability",
  "legal.copy.bases.dmca": "• DMCA (Digital Millennium Copyright Act) — Notice-and-Takedown procedure",
  "legal.copy.bases.auteurswet": "• Dutch Copyright Act (Auteurswet)",
  "legal.copy.bases.youtube": "• YouTube API Terms of Service — embedding rules",
  "legal.copy.bases.spotify": "• Spotify Developer Terms of Service — API usage rules",
  "legal.copy.bases.suno": "• Suno Terms of Service — commercial use license for AI tracks (Pro/Premier plans)",
  "legal.copy.bases.euipo": "• EUIPO position on AI-generated content — copyright status of AI-generated content",

  // Cookies
  "legal.cook.heading": "Cookie Policy",
  "legal.cook.s1.title": "1. What are cookies?",
  "legal.cook.s1.p1": "Cookies are small text files stored in the user's browser.",
  "legal.cook.s2.title": "2. What cookies do we use?",
  "legal.cook.s2.essential": "Essential — required for the Service to function (login session, preferences). Basis: Art. 6(1)(f) GDPR.",
  "legal.cook.s2.functional": "Functional — remembering settings (e.g., volume, dark mode). Basis: user consent.",
  "legal.cook.s2.analytical": "Analytical — anonymous usage analysis (we do not use Google Analytics or advertising trackers). Basis: user consent.",
  "legal.cook.s3.title": "3. Third-Party Cookies",
  "legal.cook.s3.p1": "Embedded YouTube content may set its own cookies according to Google's policy. Details: policies.google.com/privacy",
  "legal.cook.s4.title": "4. Managing Cookies",
  "legal.cook.s4.p1": "Users can delete or block cookies at any time in browser settings. Blocking essential cookies may limit Service functionality.",

  // GDPR
  "legal.gdpr.heading": "Personal Data Processing Information (GDPR)",
  "legal.gdpr.subheading": "In accordance with Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016.",
  "legal.gdpr.badge": "✅ Full GDPR Compliance",
  "legal.gdpr.badgeDesc": "GrouAI Stream processes personal data exclusively in accordance with GDPR. As a company based in the Netherlands (EU), we are directly subject to European data protection regulations.",
  "legal.gdpr.rights.title": "Your Rights (Art. 15-22 GDPR)",
  "legal.gdpr.rights.access": "Right of Access",
  "legal.gdpr.rights.accessDesc": "You can request a copy of your data",
  "legal.gdpr.rights.rectification": "Right to Rectification",
  "legal.gdpr.rights.rectificationDesc": "You can correct inaccurate data",
  "legal.gdpr.rights.erasure": "Right to Erasure",
  "legal.gdpr.rights.erasureDesc": "Right to be forgotten",
  "legal.gdpr.rights.restriction": "Right to Restriction",
  "legal.gdpr.rights.restrictionDesc": "Restriction of data processing",
  "legal.gdpr.rights.portability": "Right to Portability",
  "legal.gdpr.rights.portabilityDesc": "Export data in CSV/JSON format",
  "legal.gdpr.rights.objection": "Right to Object",
  "legal.gdpr.rights.objectionDesc": "Object to data processing",
  "legal.gdpr.biometric.title": "Biometric Data (Art. 9 GDPR)",
  "legal.gdpr.biometric.p1": "Facial analysis (mood detection) and voice analysis features are disabled by default. Activation requires explicit user consent. Biometric data is processed locally in the browser and is not transmitted to the server. Users can withdraw consent at any time in Settings → AI & Privacy.",
  "legal.gdpr.authority.title": "Supervisory Authority",
  "legal.gdpr.authority.p1": "Autoriteit Persoonsgegevens (AP) — Dutch Data Protection Authority",
  "legal.gdpr.authority.p2": "www.autoriteitpersoonsgegevens.nl",
  "legal.gdpr.authority.p3": "Every user has the right to file a complaint with the supervisory authority.",
  "legal.gdpr.dpo.title": "Data Protection Officer Contact",
  "legal.gdpr.dpo.p1": "Email: dpo@grouai.stream",
  "legal.gdpr.dpo.p2": "We respond to inquiries within 30 calendar days, in accordance with Art. 12(3) GDPR.",

  "upgrade.title": "Upgrade GrouAI Stream",
  "upgrade.subtitle": "Unlock the full potential of AI music",
  "upgrade.popular": "POPULAR",
  "upgrade.forever": "forever",
  "upgrade.perMonth": "/month",
  "upgrade.free.name": "Free",
  "upgrade.free.f1": "Basic streaming",
  "upgrade.free.f2": "Limited skips",
  "upgrade.free.f3": "Ads between songs",
  "upgrade.free.f4": "Standard quality",
  "upgrade.pro.name": "Pro",
  "upgrade.pro.f1": "Unlimited streaming",
  "upgrade.pro.f2": "No ads",
  "upgrade.pro.f3": "HQ Audio (320kbps)",
  "upgrade.pro.f4": "AI DJ & Mood Detection",
  "upgrade.pro.f5": "Offline downloads",
  "upgrade.pro.f6": "5 AI playlists/day",
  "upgrade.ultimate.name": "Ultimate",
  "upgrade.ultimate.f1": "Everything in Pro",
  "upgrade.ultimate.f2": "Lossless Audio (FLAC)",
  "upgrade.ultimate.f3": "Unlimited AI playlists",
  "upgrade.ultimate.f4": "AI Psychologist reports",
  "upgrade.ultimate.f5": "Priority support",
  "upgrade.ultimate.f6": "Early access to features",
  "upgrade.ultimate.f7": "Custom AI DJ personality",
  "upgrade.currentPlan": "Current Plan",
  "upgrade.upgradeTo": "Upgrade to",
  "upgrade.processing": "Processing...",
  "upgrade.footer": "Cancel anytime • 7-day free trial • No credit card required",
  "upgrade.alreadyFree": "You're already on the Free plan!",
  "upgrade.welcomeMsg": "🎉 Welcome to GrouAI {plan}! Enjoy premium features.",

  "moodDet.title": "AI Psychology Professor",
  "moodDet.subtitle": "TensorFlow.js + AI ready",
  "moodDet.loadingModels": "Loading face-api.js models...",
  "moodDet.loadingWait": "This may take a few seconds",
  "moodDet.tfReady": "TensorFlow.js ready",
  "moodDet.deepAnalyzing": "Deep psychiatric analysis...",
  "moodDet.analyzing": "Analyzing...",
  "moodDet.initTf": "Initializing TensorFlow.js...",
  "moodDet.detectingFace": "Detecting face...",
  "moodDet.analyzingExpression": "Analyzing facial expression...",
  "moodDet.recognizingEmotions": "Recognizing emotions...",
  "moodDet.finalizing": "Finalizing results...",
  "moodDet.noFace": "No face detected",
  "moodDet.noFaceHint": "Make sure your face is well lit",
  "moodDet.tryAgain": "Try again",
  "moodDet.cameraActive": "🎥 Camera active! Analyzing face for 5 seconds...",
  "moodDet.noCameraAccess": "No camera access. Check your permissions.",
  "moodDet.analyzeBtn": "Analyze emotions (5s)",
  "moodDet.loadingAI": "Loading AI...",
  "moodDet.starting": "Starting...",
  "moodDet.cancel": "Cancel",
  "moodDet.scanAgain": "Scan again",
  "moodDet.confidence": "detection confidence",
  "moodDet.diagnosisTitle": "Professor's Diagnosis",
  "moodDet.emotionalStateTitle": "Emotional State",
  "moodDet.riskTitle": "Risk Level",
  "moodDet.fullAnalysis": "Full psychiatric analysis",
  "moodDet.collapse": "Collapse",
  "moodDet.microExpressions": "Micro Expressions",
  "moodDet.psychInsight": "Psychological Insight",
  "moodDet.therapeuticAdvice": "Therapeutic Recommendations",
  "moodDet.musicTherapy": "Music Therapy",
  "moodDet.healingFreq": "Healing Frequency",
  "moodDet.playing5tracks": "Playing 5 tracks selected by AI Professor",
  "moodDet.boostGuarantee": "Mood +100% guaranteed!",
  "moodDet.goalLabel": "Goal",
  "moodDet.noTracks": "No tracks in the library.",
  "moodDet.trackError": "Error loading tracks.",
  "moodDet.faceError": "Error analyzing face. Try again.",
  "moodDet.analysisError": "Deep AI analysis failed.",
  "moodDet.microStep": "Analyzing micro expressions...",
  "moodDet.diagStep": "Psychiatric diagnosis...",
  "moodDet.therapyStep": "Selecting music therapy...",
  "moodDet.selectionStep": "Selecting 5 tracks...",
  "moodDet.professorAnalyzing": "🧠 AI Professor is analyzing your state...",
  "moodDet.happy": "Happy",
  "moodDet.melancholic": "Melancholic",
  "moodDet.intense": "Intense",
  "moodDet.anxious": "Anxious",
  "moodDet.rebellious": "Rebellious",
  "moodDet.excited": "Excited",
  "moodDet.relaxed": "Relaxed",
  "moodDet.energetic": "Energetic",
  "moodDet.romantic": "Romantic",
  "moodDet.focused": "Focused",
  "moodDet.happyDesc": "You're having a great day! Positive energy radiates from you!",
  "moodDet.sadDesc": "Looks like a tough day... Music will boost your mood!",
  "moodDet.angryDesc": "You're feeling intense! Time for music to release it!",
  "moodDet.fearfulDesc": "Stressful day? Calming sounds will help!",
  "moodDet.disgustedDesc": "Rebellious mood! Rock and punk for you!",
  "moodDet.surprisedDesc": "Full of excitement! Time for energetic music!",
  "moodDet.neutralDesc": "Calm, relaxed day. Perfect time to chill!",
  "moodDet.energeticDesc": "WOW! Super energetic day! Time to party!",
  "moodDet.romanticDesc": "Romantic mood... Time for beautiful melodies!",
  "moodDet.focusedDesc": "Focused and ready to go! Music will help!",
  "moodDet.aiDescription": "AI Professor will analyze your emotions and select 5 perfect tracks",
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
  "nav.sunoAI": "GrouAI Studio",
  "nav.localPlayer": "Lokale Speler",
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
  "library.startingPopulate": "Bibliotheek vullen gestart...",
  "library.batchFetching": "nummers ophalen...",
  "library.batchAdded": "toegevoegd",
  "library.goalReached": "Doel bereikt!",
  "library.donePopulated": "Klaar! Bibliotheek gevuld.",
  "library.populatedSuccess": "Bibliotheek gevuld!",
  "library.populateError": "Fout bij vullen",
  "library.pasteTokenError": "Plak Spotify token!",
  "library.fetchingSpotify": "Nummers ophalen van Spotify...",
  "library.spotifyDone": "Klaar! Opgehaald",
  "library.spotifyAddedSuccess": "nummers toegevoegd van Spotify",
  "library.spotifyImportError": "Importfout",
  "library.spotifyImportErrorMsg": "Spotify importfout.",
  "library.genreCatalogs": "Genre Catalogi",
  "library.aiSortsAuto": "AI sorteert automatisch",
  "library.tracks": "nummers",
  "library.playAll": "Alles afspelen",
  "library.deleteCatalog": "Catalogus verwijderen",
  "library.play": "Afspelen",
  "library.noTracksInCatalog": "Geen nummers in deze catalogus",
  "library.catalogDeleted": "Catalogus verwijderd",
  "library.catalogEmpty": "Catalogus is al leeg",

  "liked.title": "Favoriete Nummers",
  "liked.playlist": "Afspeellijst",
  "liked.songs": "nummers",
  "liked.play": "Afspelen",
  "liked.shuffle": "Willekeurig",
  "liked.empty": "Nog geen favoriete nummers. Begin met ontdekken en like een paar nummers!",

  "radio.openFullPlayer": "Open volledige speler",
  "radio.backHome": "Startpagina",
  "radio.nowPlaying": "Nu speelt",
  "radio.live": "LIVE",
  "radio.stationOff": "Station is momenteel offline",
  "radio.broadcasting": "Uitzending",
  "radio.upNext": "Hierna",
  "radio.poweredBy": "Powered by GrouAI Stream",
  "radio.loginToLike": "Inloggen",
  "radio.loginToLikeDesc": "Je moet inloggen om een nummer leuk te vinden.",
  "radio.unliked": "💔 Verwijderd uit favorieten",
  "radio.liked": "❤️ Leuk gevonden!",
  "radio.likedDesc": "toegevoegd aan AI-geheugen",
  "radio.likesCount": "likes",
  "radio.wishes": "Wensen",
  "radio.wishesTitle": "💬 Luisteraarswensen",
  "radio.wishPlaceholder": "Schrijf een wens, groet...",
  "radio.sendWish": "Verstuur",
  "radio.loginToChat": "Log in om wensen te schrijven",
  "radio.deleteWish": "Wens verwijderen",
  "radio.noWishes": "Wees de eerste! Schrijf een wens 🎵",

  "widget.micTooltip": "Stemassistent — praat met AI",
  "widget.chatTooltip": "AI Chat — schrijf en vraag alles",

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
  "legal.lastUpdate": "Laatst bijgewerkt: 28 februari 2026",

  // Terms content
  "legal.terms.heading": "Algemene Voorwaarden voor GrouAI Stream",
  "legal.terms.s1.title": "§1. Algemene Bepalingen",
  "legal.terms.s1.p1": "1. Deze Algemene Voorwaarden bepalen de regels voor het gebruik van het muziekplatform GrouAI Stream (hierna: \"Dienst\").",
  "legal.terms.s1.p2": "2. De Dienst wordt beheerd door GrouaRock — een pre-registratieproject gevestigd in Nederland. Registratie bij de Kamer van Koophandel (KvK) vindt plaats na het bereiken van een voldoende gebruikersbasis. Tot die tijd opereert de Dienst als eenmanszaak volgens Nederlands recht.",
  "legal.terms.s1.p3": "3. Het gebruik van de Dienst betekent acceptatie van deze Voorwaarden en het Privacybeleid.",
  "legal.terms.s2.title": "§2. Juridische Status en Registratie",
  "legal.terms.s2.badge": "📋 Registratiestatus Informatie",
  "legal.terms.s2.badgeDesc": "GrouaRock bevindt zich momenteel in de ontwikkelingsfase (pre-launch). Formele registratie bij KvK en het verkrijgen van een BTW-nummer zal plaatsvinden in overeenstemming met het Nederlandse handelsrecht na het bereiken van registratiedrempels op basis van het aantal actieve gebruikers en omzet.",
  "legal.terms.s2.p1": "1. Deze Voorwaarden vormen een bindende overeenkomst tussen de gebruiker en de Dienstbeheerder, ongeacht de registratiestatus van de entiteit.",
  "legal.terms.s2.p2": "2. De beheerder verbindt zich ertoe het bedrijf formeel te registreren bij KvK na het bereiken van 500 actieve gebruikers of €10.000 jaaromzet — in overeenstemming met Nederlands recht.",
  "legal.terms.s2.p3": "3. De Voorwaarden, het Privacybeleid en andere juridische documenten worden bijgewerkt naarmate de registratie vordert. Gebruikers worden minimaal 14 dagen van tevoren per e-mail op de hoogte gesteld van belangrijke wijzigingen.",
  "legal.terms.s2.p4": "4. Tot formele registratie draagt de beheerder volledige persoonlijke aansprakelijkheid voor de werking van de Dienst conform Art. 6:162 Burgerlijk Wetboek.",
  "legal.terms.s3.title": "§3. Diensten",
  "legal.terms.s3.p1": "1. De Dienst biedt: muziekweergave uit legale bronnen, het maken van afspeellijsten, AI-aanbevelingen en import van muziekmetadata.",
  "legal.terms.s3.p2": "2. Alle content die via de Dienst wordt aangeboden komt uit legale bronnen, waaronder: Creative Commons gelicentieerde nummers (CC Mixter), door gebruikers geüploade materialen met passende rechten, en ingebedde YouTube-content in overeenstemming met YouTube API Terms of Service.",
  "legal.terms.s3.p3": "3. De Dienst slaat geen illegale kopieën van auteursrechtelijk beschermde werken op en distribueert deze niet.",
  "legal.terms.s4.title": "§4. Gebruikersaccount",
  "legal.terms.s4.p1": "1. Registratie vereist een e-mailadres en wachtwoord.",
  "legal.terms.s4.p2": "2. De gebruiker is verantwoordelijk voor de beveiliging van zijn account.",
  "legal.terms.s4.p3": "3. Accounts kunnen worden opgeschort bij overtreding van de Voorwaarden.",
  "legal.terms.s5.title": "§5. AI-Gegenereerde Nummers (Suno en andere)",
  "legal.terms.s5.p1": "1. GrouAI Stream staat het uploaden toe van nummers die zijn gegenereerd met AI-tools zoals Suno, Udio, AIVA en andere generatieve platforms.",
  "legal.terms.s5.p2": "2. Een gebruiker die een AI-gegenereerd nummer uploadt verklaart dat:",
  "legal.terms.s5.p2a": "a) het nummer individueel is aangemaakt op zijn account bij de betreffende AI-dienst,",
  "legal.terms.s5.p2b": "b) hij het recht heeft om het nummer te distribueren in overeenstemming met de licentievoorwaarden van het generatieve platform (bijv. Suno Pro/Premier staat commercieel gebruik toe),",
  "legal.terms.s5.p2c": "c) hij GrouAI Stream een exclusieve, permanente licentie verleent om het nummer af te spelen, te delen en te verwerken binnen de Dienst,",
  "legal.terms.s5.p2d": "d) het nummer geen inbreuk maakt op auteursrechten van derden en geen plagiaat of kopie is van een bestaand beschermd werk.",
  "legal.terms.s5.p3": "3. Volgens het huidige EU-recht (standpunt EUIPO en DSM Richtlijn 2019/790) vallen volledig door AI gegenereerde werken niet onder traditionele auteursrechtbescherming vanwege het ontbreken van een menselijke auteur. Een gebruiker die een creatieve bijdrage heeft geleverd (prompt engineering, arrangement, selectie, modificatie) kan echter naburige rechten bezitten op het resultaat.",
  "legal.terms.s5.p4": "4. GrouAI Stream claimt geen auteursrecht op AI-gegenereerde nummers — rechten blijven bij de persoon die ze heeft geüpload en de licentie heeft verleend.",
  "legal.terms.s5.p5": "5. Bij geschillen over rechten op AI-nummers is de DMCA/NTD-procedure beschreven in §6 van toepassing.",
  "legal.terms.s6.title": "§6. Beperking van Aansprakelijkheid",
  "legal.terms.s6.p1": "1. De Dienst wordt aangeboden \"zoals deze is\" (as-is). We garanderen geen ononderbroken beschikbaarheid.",
  "legal.terms.s6.p2": "2. We zijn niet verantwoordelijk voor content die door gebruikers is geüpload.",
  "legal.terms.s6.p3": "3. We behouden het recht om content die inbreuk maakt op auteursrechten te verwijderen op basis van DMCA/NTD-meldingen.",
  "legal.terms.s7.title": "§7. Toepasselijk Recht",
  "legal.terms.s7.p1": "1. Deze Voorwaarden vallen onder Nederlands recht.",
  "legal.terms.s7.p2": "2. Geschillen worden beslecht door de bevoegde rechtbank voor de vestigingsplaats of woonplaats van de beheerder (tot formele registratie).",
  "legal.terms.s8.title": "§8. Wijzigingen van Voorwaarden",
  "legal.terms.s8.p1": "1. De beheerder behoudt het recht om deze Voorwaarden te wijzigen wegens veranderingen in registratiestatus, ontwikkeling van de Dienst of wettelijke wijzigingen.",
  "legal.terms.s8.p2": "2. Gebruikers worden 14 dagen van tevoren op de hoogte gesteld van wijzigingen. Voortgezet gebruik van de Dienst na deze periode betekent acceptatie van de wijzigingen.",

  // Privacy
  "legal.priv.heading": "Privacybeleid",
  "legal.priv.s1.title": "1. Verwerkingsverantwoordelijke",
  "legal.priv.s1.p1": "De verwerkingsverantwoordelijke is GrouaRock, Nederland. Contact: privacy@grouai.stream",
  "legal.priv.s2.title": "2. Omvang van Verzamelde Gegevens",
  "legal.priv.s2.p1": "Wij verzamelen de volgende gegevens: e-mailadres (registratie), weergavenaam (optioneel), luistergeschiedenis (met toestemming), stemmingsvoorkeuren (met toestemming), biometrische gegevens van camera/microfoon (alleen met uitdrukkelijke toestemming van de gebruiker).",
  "legal.priv.s3.title": "3. Doel van Gegevensverwerking",
  "legal.priv.s3.p1": "Gegevens worden verwerkt voor: levering van platformdiensten, personalisatie van AI-muziekaanbevelingen, stemmingsanalyse (optioneel), verbetering van de dienstverlening.",
  "legal.priv.s4.title": "4. Rechtsgrondslag",
  "legal.priv.s4.p1": "Verwerking is gebaseerd op: toestemming van de gebruiker (Art. 6(1)(a) AVG), uitvoering van de overeenkomst (Art. 6(1)(b) AVG), gerechtvaardigd belang van de verwerkingsverantwoordelijke (Art. 6(1)(f) AVG).",
  "legal.priv.s5.title": "5. Bewaartermijn",
  "legal.priv.s5.p1": "Gegevens worden bewaard gedurende het gebruik van het account. Na verwijdering van het account worden alle persoonsgegevens binnen 30 dagen verwijderd.",
  "legal.priv.s6.title": "6. Rechten van de Gebruiker",
  "legal.priv.s6.p1": "Elke gebruiker heeft het recht op: inzage in zijn gegevens, rectificatie van gegevens, verwijdering van gegevens (\"recht om vergeten te worden\"), beperking van verwerking, overdraagbaarheid van gegevens, bezwaar tegen verwerking, intrekking van toestemming op elk moment.",
  "legal.priv.s7.title": "7. Beveiliging",
  "legal.priv.s7.p1": "Wij gebruiken TLS/SSL-encryptie, veilige wachtwoordopslag (bcrypt), anonimisering van analytische gegevens, regelmatige beveiligingsaudits.",
  "legal.priv.s8.title": "8. Gegevensoverdracht",
  "legal.priv.s8.p1": "Gegevens kunnen alleen worden overgedragen aan derden voor dienstverlening (bijv. hosting, analyse), op basis van passende verwerkingsovereenkomsten, in overeenstemming met Standaard Contractbepalingen (SCC).",

  // Copyright
  "legal.copy.heading": "Auteursrecht & Licentiebeleid",
  "legal.copy.legalBadge": "Legaliteitsverklaring",
  "legal.copy.legalBadgeDesc": "GrouAI Stream opereert volledig in overeenstemming met de wet. Alle muzikale content komt uit legale bronnen en wordt beschikbaar gesteld onder passende licenties of fair use.",
  "legal.copy.sources.title": "Bronnen van Muzikale Content",
  "legal.copy.sources.cc": "1. Creative Commons (CC Mixter) — Primaire contentbron. Nummers gedeeld onder CC-licenties (BY, BY-NC, BY-SA, BY-NC-SA). Elk nummer toont naamsvermelding zoals vereist door de licentie.",
  "legal.copy.sources.youtube": "2. YouTube Embed (IFrame API) — YouTube-content wordt uitsluitend ingebed via de officiële YouTube IFrame Player API. Dit voldoet aan YouTube Terms of Service (Sectie 6.B). We downloaden, kopiëren of bewaren geen video-/audiocontent van YouTube.",
  "legal.copy.sources.user": "3. Door Gebruikers Geüploade Content — Gebruikers mogen alleen nummers uploaden waarop zij auteursrecht of passende licentie bezitten. Bij meldingen van inbreuk passen we de DMCA/Notice-and-Takedown procedure toe.",
  "legal.copy.sources.spotify": "4. Metadata Import (Spotify API) — We importeren alleen metadata (titel, artiest, album, hoes) via de officiële Spotify Web API. We downloaden of spelen geen audiobestanden van Spotify af. Import vindt plaats met toestemming van de gebruiker via OAuth 2.0.",
  "legal.copy.sources.ai": "5. AI-Nummers (Suno, Udio, AIVA en andere) — Nummers gegenereerd door AI-platforms en geüpload door gebruikers met passende licentie (bijv. Suno Pro/Premier). De gebruiker verleent GrouAI Stream een exclusieve licentie om af te spelen en te delen. AI-nummers maken geen inbreuk op auteursrechten van derden omdat ze algoritmisch worden gegenereerd op individueel verzoek van de gebruiker. Conform het standpunt van EUIPO en de Nederlandse Auteurswet kan de creatieve bijdrage van de gebruiker (prompt, selectie, modificatie) de basis vormen voor naburige rechten.",
  "legal.copy.dmca.title": "Procedure voor het Melden van Inbreuken (DMCA/NTD)",
  "legal.copy.dmca.p1": "Als je van mening bent dat je auteursrechten zijn geschonden, neem contact met ons op: dmca@grouai.stream",
  "legal.copy.dmca.p2": "Een melding moet bevatten: identificatie van het beschermde werk, locatie van de inbreuk in de Dienst, contactgegevens van de melder, verklaring te goeder trouw.",
  "legal.copy.dmca.p3": "We verbinden ons ertoe meldingen binnen 48 werkuren te beoordelen.",
  "legal.copy.bases.title": "Rechtsgronden",
  "legal.copy.bases.infosoc": "• Richtlijn 2001/29/EG (InfoSoc) — fair use, inbedding van content",
  "legal.copy.bases.dsm": "• Richtlijn 2019/790 (DSM) — Art. 17, platformaansprakelijkheid",
  "legal.copy.bases.dmca": "• DMCA (Digital Millennium Copyright Act) — Notice-and-Takedown procedure",
  "legal.copy.bases.auteurswet": "• Nederlandse Auteurswet",
  "legal.copy.bases.youtube": "• YouTube API Terms of Service — regels voor inbedding",
  "legal.copy.bases.spotify": "• Spotify Developer Terms of Service — regels voor API-gebruik",
  "legal.copy.bases.suno": "• Suno Terms of Service — commerciële gebruikslicentie voor AI-nummers (Pro/Premier plannen)",
  "legal.copy.bases.euipo": "• Standpunt EUIPO over AI-gegenereerde content — auteursrechtelijke status van AI-gegenereerde content",

  // Cookies
  "legal.cook.heading": "Cookiebeleid",
  "legal.cook.s1.title": "1. Wat zijn cookies?",
  "legal.cook.s1.p1": "Cookies zijn kleine tekstbestanden die worden opgeslagen in de browser van de gebruiker.",
  "legal.cook.s2.title": "2. Welke cookies gebruiken wij?",
  "legal.cook.s2.essential": "Essentieel — vereist voor het functioneren van de Dienst (inlogsessie, voorkeuren). Grondslag: Art. 6(1)(f) AVG.",
  "legal.cook.s2.functional": "Functioneel — onthouden van instellingen (bijv. volume, donkere modus). Grondslag: toestemming van de gebruiker.",
  "legal.cook.s2.analytical": "Analytisch — anonieme gebruiksanalyse (we gebruiken geen Google Analytics of reclametrackers). Grondslag: toestemming van de gebruiker.",
  "legal.cook.s3.title": "3. Cookies van Derden",
  "legal.cook.s3.p1": "Ingebedde YouTube-content kan eigen cookies plaatsen volgens het beleid van Google. Details: policies.google.com/privacy",
  "legal.cook.s4.title": "4. Cookies Beheren",
  "legal.cook.s4.p1": "Gebruikers kunnen cookies op elk moment verwijderen of blokkeren in de browserinstellingen. Het blokkeren van essentiële cookies kan de functionaliteit van de Dienst beperken.",

  // GDPR
  "legal.gdpr.heading": "Informatie over Verwerking van Persoonsgegevens (AVG)",
  "legal.gdpr.subheading": "In overeenstemming met Verordening (EU) 2016/679 van het Europees Parlement en de Raad van 27 april 2016.",
  "legal.gdpr.badge": "✅ Volledige AVG-Naleving",
  "legal.gdpr.badgeDesc": "GrouAI Stream verwerkt persoonsgegevens uitsluitend in overeenstemming met de AVG. Als bedrijf gevestigd in Nederland (EU) vallen we rechtstreeks onder de Europese regelgeving voor gegevensbescherming.",
  "legal.gdpr.rights.title": "Jouw Rechten (Art. 15-22 AVG)",
  "legal.gdpr.rights.access": "Recht op Inzage",
  "legal.gdpr.rights.accessDesc": "Je kunt een kopie van je gegevens opvragen",
  "legal.gdpr.rights.rectification": "Recht op Rectificatie",
  "legal.gdpr.rights.rectificationDesc": "Je kunt onjuiste gegevens corrigeren",
  "legal.gdpr.rights.erasure": "Recht op Verwijdering",
  "legal.gdpr.rights.erasureDesc": "Recht om vergeten te worden",
  "legal.gdpr.rights.restriction": "Recht op Beperking",
  "legal.gdpr.rights.restrictionDesc": "Beperking van gegevensverwerking",
  "legal.gdpr.rights.portability": "Recht op Overdraagbaarheid",
  "legal.gdpr.rights.portabilityDesc": "Gegevens exporteren in CSV/JSON formaat",
  "legal.gdpr.rights.objection": "Recht van Bezwaar",
  "legal.gdpr.rights.objectionDesc": "Bezwaar tegen gegevensverwerking",
  "legal.gdpr.biometric.title": "Biometrische Gegevens (Art. 9 AVG)",
  "legal.gdpr.biometric.p1": "Gezichtsanalyse (stemmingsdetectie) en stemanalysefuncties zijn standaard uitgeschakeld. Activering vereist uitdrukkelijke toestemming van de gebruiker. Biometrische gegevens worden lokaal in de browser verwerkt en niet naar de server verzonden. Gebruikers kunnen hun toestemming op elk moment intrekken via Instellingen → AI & Privacy.",
  "legal.gdpr.authority.title": "Toezichthoudende Autoriteit",
  "legal.gdpr.authority.p1": "Autoriteit Persoonsgegevens (AP) — Nederlandse Gegevensbeschermingsautoriteit",
  "legal.gdpr.authority.p2": "www.autoriteitpersoonsgegevens.nl",
  "legal.gdpr.authority.p3": "Elke gebruiker heeft het recht een klacht in te dienen bij de toezichthoudende autoriteit.",
  "legal.gdpr.dpo.title": "Contact Functionaris voor Gegevensbescherming",
  "legal.gdpr.dpo.p1": "E-mail: dpo@grouai.stream",
  "legal.gdpr.dpo.p2": "We reageren op vragen binnen 30 kalenderdagen, conform Art. 12(3) AVG.",

  "upgrade.title": "Upgrade GrouAI Stream",
  "upgrade.subtitle": "Ontgrendel het volledige potentieel van AI-muziek",
  "upgrade.popular": "POPULAIR",
  "upgrade.forever": "voor altijd",
  "upgrade.perMonth": "/maand",
  "upgrade.free.name": "Gratis",
  "upgrade.free.f1": "Basis streaming",
  "upgrade.free.f2": "Beperkt overslaan",
  "upgrade.free.f3": "Advertenties tussen nummers",
  "upgrade.free.f4": "Standaard kwaliteit",
  "upgrade.pro.name": "Pro",
  "upgrade.pro.f1": "Onbeperkt streamen",
  "upgrade.pro.f2": "Geen advertenties",
  "upgrade.pro.f3": "HQ Audio (320kbps)",
  "upgrade.pro.f4": "AI DJ & Stemmingsdetectie",
  "upgrade.pro.f5": "Offline downloads",
  "upgrade.pro.f6": "5 AI-afspeellijsten/dag",
  "upgrade.ultimate.name": "Ultimate",
  "upgrade.ultimate.f1": "Alles uit Pro",
  "upgrade.ultimate.f2": "Lossless Audio (FLAC)",
  "upgrade.ultimate.f3": "Onbeperkte AI-afspeellijsten",
  "upgrade.ultimate.f4": "AI Psycholoog rapporten",
  "upgrade.ultimate.f5": "Prioriteitsondersteuning",
  "upgrade.ultimate.f6": "Vroege toegang tot functies",
  "upgrade.ultimate.f7": "Aangepaste AI DJ persoonlijkheid",
  "upgrade.currentPlan": "Huidig Abonnement",
  "upgrade.upgradeTo": "Upgraden naar",
  "upgrade.processing": "Verwerken...",
  "upgrade.footer": "Op elk moment opzeggen • 7 dagen gratis proberen • Geen creditcard nodig",
  "upgrade.alreadyFree": "Je hebt al het gratis abonnement!",
  "upgrade.welcomeMsg": "🎉 Welkom bij GrouAI {plan}! Geniet van premium functies.",

  "moodDet.title": "AI Professor Psychologie",
  "moodDet.subtitle": "TensorFlow.js + AI klaar",
  "moodDet.loadingModels": "Face-api.js modellen laden...",
  "moodDet.loadingWait": "Dit kan enkele seconden duren",
  "moodDet.tfReady": "TensorFlow.js klaar",
  "moodDet.deepAnalyzing": "Diepe psychiatrische analyse...",
  "moodDet.analyzing": "Analyseren...",
  "moodDet.initTf": "TensorFlow.js initialiseren...",
  "moodDet.detectingFace": "Gezicht detecteren...",
  "moodDet.analyzingExpression": "Gezichtsuitdrukking analyseren...",
  "moodDet.recognizingEmotions": "Emoties herkennen...",
  "moodDet.finalizing": "Resultaten afronden...",
  "moodDet.noFace": "Geen gezicht gedetecteerd",
  "moodDet.noFaceHint": "Zorg dat je gezicht goed verlicht is",
  "moodDet.tryAgain": "Probeer opnieuw",
  "moodDet.cameraActive": "🎥 Camera actief! Gezicht wordt 5 seconden geanalyseerd...",
  "moodDet.noCameraAccess": "Geen cameratoegang. Controleer je rechten.",
  "moodDet.analyzeBtn": "Emoties analyseren (5s)",
  "moodDet.loadingAI": "AI laden...",
  "moodDet.starting": "Starten...",
  "moodDet.cancel": "Annuleren",
  "moodDet.scanAgain": "Opnieuw scannen",
  "moodDet.confidence": "detectie zekerheid",
  "moodDet.diagnosisTitle": "Diagnose van de Professor",
  "moodDet.emotionalStateTitle": "Emotionele Toestand",
  "moodDet.riskTitle": "Risiconiveau",
  "moodDet.fullAnalysis": "Volledige psychiatrische analyse",
  "moodDet.collapse": "Inklappen",
  "moodDet.microExpressions": "Micro-expressies",
  "moodDet.psychInsight": "Psychologisch Inzicht",
  "moodDet.therapeuticAdvice": "Therapeutische Aanbevelingen",
  "moodDet.musicTherapy": "Muziektherapie",
  "moodDet.healingFreq": "Helende Frequentie",
  "moodDet.playing5tracks": "5 nummers geselecteerd door AI Professor",
  "moodDet.boostGuarantee": "Stemming +100% gegarandeerd!",
  "moodDet.goalLabel": "Doel",
  "moodDet.noTracks": "Geen nummers in de bibliotheek.",
  "moodDet.trackError": "Fout bij laden van nummers.",
  "moodDet.faceError": "Fout bij gezichtsanalyse. Probeer opnieuw.",
  "moodDet.analysisError": "Diepe AI-analyse mislukt.",
  "moodDet.microStep": "Micro-expressies analyseren...",
  "moodDet.diagStep": "Psychiatrische diagnose...",
  "moodDet.therapyStep": "Muziektherapie selecteren...",
  "moodDet.selectionStep": "5 nummers selecteren...",
  "moodDet.professorAnalyzing": "🧠 AI Professor analyseert je toestand...",
  "moodDet.happy": "Gelukkig",
  "moodDet.melancholic": "Melancholisch",
  "moodDet.intense": "Intens",
  "moodDet.anxious": "Angstig",
  "moodDet.rebellious": "Rebels",
  "moodDet.excited": "Opgewonden",
  "moodDet.relaxed": "Ontspannen",
  "moodDet.energetic": "Energiek",
  "moodDet.romantic": "Romantisch",
  "moodDet.focused": "Gefocust",
  "moodDet.happyDesc": "Je hebt een geweldige dag! Positieve energie straalt van je af!",
  "moodDet.sadDesc": "Het lijkt een zware dag... Muziek zal je stemming verbeteren!",
  "moodDet.angryDesc": "Je voelt je intens! Tijd voor muziek om het los te laten!",
  "moodDet.fearfulDesc": "Stressvolle dag? Kalmerende klanken helpen!",
  "moodDet.disgustedDesc": "Rebelse stemming! Rock en punk voor jou!",
  "moodDet.surprisedDesc": "Vol opwinding! Tijd voor energieke muziek!",
  "moodDet.neutralDesc": "Rustige, ontspannen dag. Perfect moment om te chillen!",
  "moodDet.energeticDesc": "WOW! Super energieke dag! Tijd om te feesten!",
  "moodDet.romanticDesc": "Romantische stemming... Tijd voor mooie melodieën!",
  "moodDet.focusedDesc": "Gefocust en klaar voor actie! Muziek helpt!",
  "moodDet.aiDescription": "AI Professor analyseert je emoties en selecteert 5 perfecte nummers",
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
  "nav.sunoAI": "GrouAI Studio",
  "nav.localPlayer": "Локальний Плеєр",
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
  "library.startingPopulate": "Починаю заповнення бібліотеки...",
  "library.batchFetching": "завантажую треки...",
  "library.batchAdded": "додано",
  "library.goalReached": "Мету досягнуто!",
  "library.donePopulated": "Готово! Бібліотеку заповнено.",
  "library.populatedSuccess": "Бібліотеку заповнено!",
  "library.populateError": "Помилка заповнення",
  "library.pasteTokenError": "Вставте токен Spotify!",
  "library.fetchingSpotify": "Завантажую треки зі Spotify...",
  "library.spotifyDone": "Готово! Завантажено",
  "library.spotifyAddedSuccess": "треків додано зі Spotify",
  "library.spotifyImportError": "Помилка імпорту",
  "library.spotifyImportErrorMsg": "Помилка імпорту Spotify.",
  "library.genreCatalogs": "Каталоги жанрів",
  "library.aiSortsAuto": "AI сортує автоматично",
  "library.tracks": "треків",
  "library.playAll": "Відтворити все",
  "library.deleteCatalog": "Видалити каталог",
  "library.play": "Відтворити",
  "library.noTracksInCatalog": "Немає треків у цьому каталозі",
  "library.catalogDeleted": "Каталог видалено",
  "library.catalogEmpty": "Каталог вже порожній",

  "liked.title": "Вподобані Пісні",
  "liked.playlist": "Плейлист",
  "liked.songs": "пісень",
  "liked.play": "Відтворити",
  "liked.shuffle": "Перемішати",
  "liked.empty": "Поки немає вподобаних пісень. Почніть досліджувати та вподобайте декілька треків!",

  "radio.openFullPlayer": "Відкрити повний плеєр",
  "radio.backHome": "Головна",
  "radio.nowPlaying": "Зараз грає",
  "radio.live": "НАЖИВО",
  "radio.stationOff": "Станція наразі не працює",
  "radio.broadcasting": "Трансляція",
  "radio.upNext": "Далі в програмі",
  "radio.poweredBy": "Powered by GrouAI Stream",
  "radio.loginToLike": "Увійти",
  "radio.loginToLikeDesc": "Щоб вподобати трек, потрібно увійти.",
  "radio.unliked": "💔 Видалено з вподобаних",
  "radio.liked": "❤️ Вподобано!",
  "radio.likedDesc": "додано до пам'яті AI",
  "radio.likesCount": "вподобань",
  "radio.wishes": "Побажання",
  "radio.wishesTitle": "💬 Побажання слухачів",
  "radio.wishPlaceholder": "Напишіть побажання, привітання...",
  "radio.sendWish": "Надіслати",
  "radio.loginToChat": "Увійдіть щоб писати побажання",
  "radio.deleteWish": "Видалити побажання",
  "radio.noWishes": "Будьте першим! Напишіть побажання 🎵",

  "widget.micTooltip": "Голосовий асистент — говоріть з AI",
  "widget.chatTooltip": "Чат з AI — пишіть і питайте про все",

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
  "legal.lastUpdate": "Останнє оновлення: 28 лютого 2026 р.",

  // Terms content
  "legal.terms.heading": "Умови використання сервісу GrouAI Stream",
  "legal.terms.s1.title": "§1. Загальні положення",
  "legal.terms.s1.p1": "1. Ці Умови використання визначають правила користування музичною платформою GrouAI Stream (далі: «Сервіс»).",
  "legal.terms.s1.p2": "2. Сервіс управляється GrouaRock — проект у фазі попередньої реєстрації, з запланованим місцезнаходженням у Нідерландах. Реєстрація в Торговій палаті (Kamer van Koophandel, KvK) відбудеться після досягнення достатньої бази користувачів. До цього моменту Сервіс працює як індивідуальне підприємство (eenmanszaak) за голландським правом.",
  "legal.terms.s1.p3": "3. Використання Сервісу означає прийняття цих Умов використання та Політики конфіденційності.",
  "legal.terms.s2.title": "§2. Правовий статус та реєстрація",
  "legal.terms.s2.badge": "📋 Інформація про статус реєстрації",
  "legal.terms.s2.badgeDesc": "GrouaRock наразі перебуває у фазі розробки (pre-launch). Формальна реєстрація в KvK та отримання номера BTW (ПДВ) відбудеться відповідно до голландського комерційного права після досягнення реєстраційних порогів, залежних від кількості активних користувачів та обороту.",
  "legal.terms.s2.p1": "1. Ці Умови є обов'язковою угодою між користувачем та оператором Сервісу, незалежно від реєстраційного статусу суб'єкта.",
  "legal.terms.s2.p2": "2. Оператор зобов'язується формально зареєструвати підприємство в KvK після досягнення порогу 500 активних користувачів або 10 000 EUR річного обороту — відповідно до вимог голландського права.",
  "legal.terms.s2.p3": "3. Умови, Політика конфіденційності та інші юридичні документи будуть оновлюватися з прогресом реєстрації. Про кожну суттєву зміну користувачі будуть повідомлені щонайменше за 14 днів електронною поштою.",
  "legal.terms.s2.p4": "4. До моменту формальної реєстрації оператор несе повну особисту відповідальність за роботу Сервісу відповідно до ст. 6:162 Цивільного кодексу Нідерландів (Burgerlijk Wetboek).",
  "legal.terms.s3.title": "§3. Послуги",
  "legal.terms.s3.p1": "1. Сервіс надає: відтворення музики з легальних джерел, створення плейлистів, рекомендації AI, імпорт музичних метаданих.",
  "legal.terms.s3.p2": "2. Весь контент, що надається через Сервіс, походить з легальних джерел, включаючи: треки з ліцензією Creative Commons (CC Mixter), матеріали завантажені користувачами з відповідними правами, та вбудований контент YouTube відповідно до YouTube API Terms of Service.",
  "legal.terms.s3.p3": "3. Сервіс не зберігає та не розповсюджує нелегальні копії творів, захищених авторським правом.",
  "legal.terms.s4.title": "§4. Обліковий запис користувача",
  "legal.terms.s4.p1": "1. Реєстрація вимагає адресу електронної пошти та пароля.",
  "legal.terms.s4.p2": "2. Користувач відповідає за безпеку свого облікового запису.",
  "legal.terms.s4.p3": "3. Облікові записи можуть бути призупинені у разі порушення Умов.",
  "legal.terms.s5.title": "§5. Треки, згенеровані AI (Suno та інші)",
  "legal.terms.s5.p1": "1. GrouAI Stream дозволяє завантаження треків, згенерованих за допомогою інструментів AI, таких як Suno, Udio, AIVA та інші генеративні платформи.",
  "legal.terms.s5.p2": "2. Користувач, який завантажує трек, згенерований AI, заявляє, що:",
  "legal.terms.s5.p2a": "a) трек був індивідуально створений на його обліковому записі у відповідному сервісі AI,",
  "legal.terms.s5.p2b": "b) він має право на розповсюдження треку відповідно до умов ліцензії генеративної платформи (наприклад, Suno Pro/Premier дозволяє комерційне використання),",
  "legal.terms.s5.p2c": "c) він надає GrouAI Stream виключну, безстрокову ліцензію на відтворення, поширення та обробку треку в рамках Сервісу,",
  "legal.terms.s5.p2d": "d) трек не порушує авторських прав третіх осіб, не є плагіатом або копією існуючого захищеного твору.",
  "legal.terms.s5.p3": "3. Відповідно до чинного законодавства ЄС (позиція EUIPO та Директива DSM 2019/790), повністю згенеровані AI твори не підлягають традиційному захисту авторських прав через відсутність людського автора. Однак користувач, який зробив творчий внесок (prompt engineering, аранжування, відбір, модифікація), може мати суміжні права на результат.",
  "legal.terms.s5.p4": "4. GrouAI Stream не претендує на авторські права на треки, згенеровані AI — права залишаються за особою, яка їх завантажила та надала ліцензію.",
  "legal.terms.s5.p5": "5. У разі спору щодо прав на AI-трек застосовується процедура DMCA/NTD, описана в §6.",
  "legal.terms.s6.title": "§6. Обмеження відповідальності",
  "legal.terms.s6.p1": "1. Сервіс надається «як є» (as-is). Ми не гарантуємо безперебійну доступність.",
  "legal.terms.s6.p2": "2. Ми не несемо відповідальності за контент, завантажений користувачами.",
  "legal.terms.s6.p3": "3. Ми залишаємо за собою право видаляти контент, що порушує авторські права, на підставі повідомлень DMCA/NTD.",
  "legal.terms.s7.title": "§7. Застосовне право",
  "legal.terms.s7.p1": "1. Ці Умови регулюються голландським правом.",
  "legal.terms.s7.p2": "2. Спори вирішуються судом, компетентним для місцезнаходження або місця проживання оператора (до формальної реєстрації).",
  "legal.terms.s8.title": "§8. Зміни Умов",
  "legal.terms.s8.p1": "1. Оператор залишає за собою право змінювати ці Умови у зв'язку зі зміною реєстраційного статусу, розвитком функціональності Сервісу або правовими змінами.",
  "legal.terms.s8.p2": "2. Про зміни користувачі будуть повідомлені за 14 днів. Подальше використання Сервісу після цього терміну означає прийняття змін.",

  // Privacy
  "legal.priv.heading": "Політика Конфіденційності",
  "legal.priv.s1.title": "1. Контролер даних",
  "legal.priv.s1.p1": "Контролером персональних даних є GrouaRock, Нідерланди. Контакт: privacy@grouai.stream",
  "legal.priv.s2.title": "2. Обсяг зібраних даних",
  "legal.priv.s2.p1": "Ми збираємо наступні дані: адресу електронної пошти (реєстрація), ім'я для відображення (необов'язково), історію прослуховування (за згодою), преференції настрою (за згодою), біометричні дані з камери/мікрофона (тільки за явною згодою користувача).",
  "legal.priv.s3.title": "3. Мета обробки даних",
  "legal.priv.s3.p1": "Дані обробляються для: надання послуг платформи, персоналізації рекомендацій AI, аналізу настрою (необов'язково), покращення якості послуг.",
  "legal.priv.s4.title": "4. Правова основа",
  "legal.priv.s4.p1": "Обробка базується на: згоді користувача (ст. 6(1)(a) GDPR), виконанні договору (ст. 6(1)(b) GDPR), законному інтересі контролера (ст. 6(1)(f) GDPR).",
  "legal.priv.s5.title": "5. Термін зберігання",
  "legal.priv.s5.p1": "Дані зберігаються протягом періоду використання облікового запису. Після видалення облікового запису всі персональні дані видаляються протягом 30 днів.",
  "legal.priv.s6.title": "6. Права користувача",
  "legal.priv.s6.p1": "Кожен користувач має право на: доступ до своїх даних, виправлення даних, видалення даних («право бути забутим»), обмеження обробки, перенесення даних, заперечення проти обробки, відкликання згоди в будь-який час.",
  "legal.priv.s7.title": "7. Безпека",
  "legal.priv.s7.p1": "Ми використовуємо шифрування TLS/SSL, безпечне зберігання паролів (bcrypt), анонімізацію аналітичних даних, регулярні аудити безпеки.",
  "legal.priv.s8.title": "8. Передача даних",
  "legal.priv.s8.p1": "Дані можуть передаватися третім сторонам виключно для надання послуг (наприклад, хостинг, аналітика), на основі відповідних угод про обробку даних, відповідно до Стандартних Договірних Застережень (SCC).",

  // Copyright
  "legal.copy.heading": "Політика авторських прав та ліцензування",
  "legal.copy.legalBadge": "Заява про легальність",
  "legal.copy.legalBadgeDesc": "GrouAI Stream працює у повній відповідності до закону. Весь музичний контент походить з легальних джерел та надається на основі відповідних ліцензій або добросовісного використання.",
  "legal.copy.sources.title": "Джерела музичного контенту",
  "legal.copy.sources.cc": "1. Creative Commons (CC Mixter) — Основне джерело контенту. Треки поширюються за ліцензіями CC (BY, BY-NC, BY-SA, BY-NC-SA). Кожен трек має відображену атрибуцію відповідно до вимог ліцензії.",
  "legal.copy.sources.youtube": "2. YouTube Embed (IFrame API) — Контент YouTube вбудовується виключно через офіційне YouTube IFrame Player API. Це відповідає YouTube Terms of Service (Розділ 6.B). Ми не завантажуємо, не копіюємо та не зберігаємо відео/аудіо контент з YouTube.",
  "legal.copy.sources.user": "3. Контент завантажений користувачами — Користувачі можуть завантажувати лише треки, на які вони мають авторські права або відповідну ліцензію. У разі повідомлень про порушення ми застосовуємо процедуру DMCA/Notice-and-Takedown.",
  "legal.copy.sources.spotify": "4. Імпорт метаданих (Spotify API) — Ми імпортуємо лише метадані (назва, артист, альбом, обкладинка) через офіційне Spotify Web API. Ми не завантажуємо та не відтворюємо аудіо файли зі Spotify. Імпорт відбувається за згодою користувача через OAuth 2.0.",
  "legal.copy.sources.ai": "5. AI-треки (Suno, Udio, AIVA та інші) — Треки згенеровані AI-платформами та завантажені користувачами з відповідною ліцензією (наприклад, Suno Pro/Premier). Користувач надає GrouAI Stream виключну ліцензію на відтворення та поширення. AI-треки не порушують авторських прав третіх осіб, оскільки генеруються алгоритмічно за індивідуальним замовленням користувача. Відповідно до позиції EUIPO та голландського Auteurswet, творчий внесок користувача (prompt, відбір, модифікація) може бути основою суміжних прав.",
  "legal.copy.dmca.title": "Процедура повідомлення про порушення (DMCA/NTD)",
  "legal.copy.dmca.p1": "Якщо ви вважаєте, що ваші авторські права були порушені, зв'яжіться з нами: dmca@grouai.stream",
  "legal.copy.dmca.p2": "Повідомлення повинно містити: ідентифікацію захищеного твору, місце порушення в Сервісі, контактні дані заявника, заяву про добросовісність.",
  "legal.copy.dmca.p3": "Ми зобов'язуємося розглянути повідомлення протягом 48 робочих годин.",
  "legal.copy.bases.title": "Правові основи",
  "legal.copy.bases.infosoc": "• Директива 2001/29/ЄС (InfoSoc) — добросовісне використання, вбудовування контенту",
  "legal.copy.bases.dsm": "• Директива 2019/790 (DSM) — ст. 17, відповідальність платформ",
  "legal.copy.bases.dmca": "• DMCA (Digital Millennium Copyright Act) — процедура Notice-and-Takedown",
  "legal.copy.bases.auteurswet": "• Голландський Закон про авторське право (Auteurswet)",
  "legal.copy.bases.youtube": "• YouTube API Terms of Service — правила вбудовування",
  "legal.copy.bases.spotify": "• Spotify Developer Terms of Service — правила використання API",
  "legal.copy.bases.suno": "• Suno Terms of Service — ліцензія на комерційне використання AI-треків (плани Pro/Premier)",
  "legal.copy.bases.euipo": "• Позиція EUIPO щодо AI-generated content — правовий статус контенту, згенерованого AI",

  // Cookies
  "legal.cook.heading": "Політика файлів Cookie",
  "legal.cook.s1.title": "1. Що таке файли cookie?",
  "legal.cook.s1.p1": "Файли cookie — це невеликі текстові файли, що зберігаються у браузері користувача.",
  "legal.cook.s2.title": "2. Які cookie ми використовуємо?",
  "legal.cook.s2.essential": "Необхідні — потрібні для роботи Сервісу (сеанс входу, налаштування). Основа: ст. 6(1)(f) GDPR.",
  "legal.cook.s2.functional": "Функціональні — запам'ятовування налаштувань (наприклад, гучність, темний режим). Основа: згода користувача.",
  "legal.cook.s2.analytical": "Аналітичні — анонімний аналіз використання (ми не використовуємо Google Analytics або рекламні трекери). Основа: згода користувача.",
  "legal.cook.s3.title": "3. Cookie третіх сторін",
  "legal.cook.s3.p1": "Вбудований контент YouTube може встановлювати власні cookie відповідно до політики Google. Деталі: policies.google.com/privacy",
  "legal.cook.s4.title": "4. Керування cookie",
  "legal.cook.s4.p1": "Користувачі можуть в будь-який час видалити або заблокувати cookie в налаштуваннях браузера. Блокування необхідних cookie може обмежити функціональність Сервісу.",

  // GDPR
  "legal.gdpr.heading": "Інформація про обробку персональних даних (GDPR)",
  "legal.gdpr.subheading": "Відповідно до Регламенту (ЄС) 2016/679 Європейського Парламенту та Ради від 27 квітня 2016 року.",
  "legal.gdpr.badge": "✅ Повна відповідність GDPR",
  "legal.gdpr.badgeDesc": "GrouAI Stream обробляє персональні дані виключно відповідно до GDPR. Як компанія з місцезнаходженням у Нідерландах (ЄС), ми безпосередньо підпорядковуємося європейським нормам захисту персональних даних.",
  "legal.gdpr.rights.title": "Ваші права (ст. 15-22 GDPR)",
  "legal.gdpr.rights.access": "Право на доступ",
  "legal.gdpr.rights.accessDesc": "Ви можете запросити копію своїх даних",
  "legal.gdpr.rights.rectification": "Право на виправлення",
  "legal.gdpr.rights.rectificationDesc": "Ви можете виправити неточні дані",
  "legal.gdpr.rights.erasure": "Право на видалення",
  "legal.gdpr.rights.erasureDesc": "Право бути забутим",
  "legal.gdpr.rights.restriction": "Право на обмеження",
  "legal.gdpr.rights.restrictionDesc": "Обмеження обробки даних",
  "legal.gdpr.rights.portability": "Право на перенесення",
  "legal.gdpr.rights.portabilityDesc": "Експорт даних у форматі CSV/JSON",
  "legal.gdpr.rights.objection": "Право на заперечення",
  "legal.gdpr.rights.objectionDesc": "Заперечення проти обробки даних",
  "legal.gdpr.biometric.title": "Біометричні дані (ст. 9 GDPR)",
  "legal.gdpr.biometric.p1": "Функції аналізу обличчя (визначення настрою) та аналізу голосу за замовчуванням вимкнені. Активація вимагає явної згоди користувача. Біометричні дані обробляються локально у браузері та не передаються на сервер. Користувачі можуть відкликати згоду в будь-який час у Налаштуваннях → AI та Приватність.",
  "legal.gdpr.authority.title": "Наглядовий орган",
  "legal.gdpr.authority.p1": "Autoriteit Persoonsgegevens (AP) — Голландський орган захисту персональних даних",
  "legal.gdpr.authority.p2": "www.autoriteitpersoonsgegevens.nl",
  "legal.gdpr.authority.p3": "Кожен користувач має право подати скаргу до наглядового органу.",
  "legal.gdpr.dpo.title": "Контакт з Офіцером захисту даних",
  "legal.gdpr.dpo.p1": "E-mail: dpo@grouai.stream",
  "legal.gdpr.dpo.p2": "Ми відповідаємо на запити протягом 30 календарних днів, відповідно до ст. 12(3) GDPR.",

  "upgrade.title": "Покращити GrouAI Stream",
  "upgrade.subtitle": "Розблокуйте повний потенціал AI музики",
  "upgrade.popular": "ПОПУЛЯРНЕ",
  "upgrade.forever": "назавжди",
  "upgrade.perMonth": "/місяць",
  "upgrade.free.name": "Безкоштовний",
  "upgrade.free.f1": "Базове прослуховування",
  "upgrade.free.f2": "Обмежене пропускання",
  "upgrade.free.f3": "Реклама між піснями",
  "upgrade.free.f4": "Стандартна якість",
  "upgrade.pro.name": "Pro",
  "upgrade.pro.f1": "Необмежене прослуховування",
  "upgrade.pro.f2": "Без реклами",
  "upgrade.pro.f3": "Висока якість (320kbps)",
  "upgrade.pro.f4": "AI DJ та Визначення Настрою",
  "upgrade.pro.f5": "Завантаження офлайн",
  "upgrade.pro.f6": "5 AI плейлистів на день",
  "upgrade.ultimate.name": "Ultimate",
  "upgrade.ultimate.f1": "Все з Pro",
  "upgrade.ultimate.f2": "Безвтратне аудіо (FLAC)",
  "upgrade.ultimate.f3": "Необмежені AI плейлисти",
  "upgrade.ultimate.f4": "Звіти AI Психолога",
  "upgrade.ultimate.f5": "Пріоритетна підтримка",
  "upgrade.ultimate.f6": "Ранній доступ до функцій",
  "upgrade.ultimate.f7": "Індивідуальна особистість AI DJ",
  "upgrade.currentPlan": "Поточний План",
  "upgrade.upgradeTo": "Покращити до",
  "upgrade.processing": "Обробка...",
  "upgrade.footer": "Скасувати в будь-який час • 7-денний безкоштовний період • Без кредитної картки",
  "upgrade.alreadyFree": "У вас вже безкоштовний план!",
  "upgrade.welcomeMsg": "🎉 Ласкаво просимо до GrouAI {plan}! Насолоджуйтесь преміум функціями.",

  "moodDet.title": "AI Професор Психології",
  "moodDet.subtitle": "TensorFlow.js + AI готовий",
  "moodDet.loadingModels": "Завантаження моделей face-api.js...",
  "moodDet.loadingWait": "Це може тривати кілька секунд",
  "moodDet.tfReady": "TensorFlow.js готовий",
  "moodDet.deepAnalyzing": "Глибокий психіатричний аналіз...",
  "moodDet.analyzing": "Аналізую...",
  "moodDet.initTf": "Ініціалізація TensorFlow.js...",
  "moodDet.detectingFace": "Виявлення обличчя...",
  "moodDet.analyzingExpression": "Аналіз виразу обличчя...",
  "moodDet.recognizingEmotions": "Розпізнавання емоцій...",
  "moodDet.finalizing": "Завершення результатів...",
  "moodDet.noFace": "Обличчя не виявлено",
  "moodDet.noFaceHint": "Переконайтесь, що обличчя добре освітлене",
  "moodDet.tryAgain": "Спробувати знову",
  "moodDet.cameraActive": "🎥 Камера активна! Аналізую обличчя протягом 5 секунд...",
  "moodDet.noCameraAccess": "Немає доступу до камери. Перевірте дозволи.",
  "moodDet.analyzeBtn": "Аналізувати емоції (5с)",
  "moodDet.loadingAI": "Завантаження AI...",
  "moodDet.starting": "Запуск...",
  "moodDet.cancel": "Скасувати",
  "moodDet.scanAgain": "Сканувати знову",
  "moodDet.confidence": "впевненість детекції",
  "moodDet.diagnosisTitle": "Діагноз Професора",
  "moodDet.emotionalStateTitle": "Емоційний Стан",
  "moodDet.riskTitle": "Рівень Ризику",
  "moodDet.fullAnalysis": "Повний психіатричний аналіз",
  "moodDet.collapse": "Згорнути",
  "moodDet.microExpressions": "Мікровирази",
  "moodDet.psychInsight": "Психологічний Інсайт",
  "moodDet.therapeuticAdvice": "Терапевтичні Рекомендації",
  "moodDet.musicTherapy": "Музикотерапія",
  "moodDet.healingFreq": "Цілюща Частота",
  "moodDet.playing5tracks": "Граю 5 треків, підібраних AI Професором",
  "moodDet.boostGuarantee": "Настрій +100% гарантовано!",
  "moodDet.goalLabel": "Ціль",
  "moodDet.noTracks": "Немає треків у бібліотеці.",
  "moodDet.trackError": "Помилка завантаження треків.",
  "moodDet.faceError": "Помилка аналізу обличчя. Спробуйте знову.",
  "moodDet.analysisError": "Глибокий AI аналіз не вдався.",
  "moodDet.microStep": "Аналіз мікровиразів...",
  "moodDet.diagStep": "Психіатричний діагноз...",
  "moodDet.therapyStep": "Підбір музикотерапії...",
  "moodDet.selectionStep": "Відбір 5 треків...",
  "moodDet.professorAnalyzing": "🧠 AI Професор аналізує ваш стан...",
  "moodDet.happy": "Щасливий",
  "moodDet.melancholic": "Меланхолійний",
  "moodDet.intense": "Інтенсивний",
  "moodDet.anxious": "Тривожний",
  "moodDet.rebellious": "Бунтівний",
  "moodDet.excited": "Збуджений",
  "moodDet.relaxed": "Розслаблений",
  "moodDet.energetic": "Енергійний",
  "moodDet.romantic": "Романтичний",
  "moodDet.focused": "Зосереджений",
  "moodDet.happyDesc": "У вас чудовий день! Позитивна енергія випромінює від вас!",
  "moodDet.sadDesc": "Виглядає на важкий день... Музика покращить настрій!",
  "moodDet.angryDesc": "Ви відчуваєте інтенсивно! Час для музики, щоб звільнити це!",
  "moodDet.fearfulDesc": "Стресовий день? Заспокійливі звуки допоможуть!",
  "moodDet.disgustedDesc": "Бунтівний настрій! Рок і панк для вас!",
  "moodDet.surprisedDesc": "Повні збудження! Час для енергійної музики!",
  "moodDet.neutralDesc": "Спокійний, розслаблений день. Ідеальний час для відпочинку!",
  "moodDet.energeticDesc": "ВАУ! Супер енергійний день! Час запалювати!",
  "moodDet.romanticDesc": "Романтичний настрій... Час для прекрасних мелодій!",
  "moodDet.focusedDesc": "Зосереджений і готовий до дії! Музика допоможе!",
  "moodDet.aiDescription": "AI Професор проаналізує ваші емоції та підбере 5 ідеальних треків",
};

export const translations: Record<Language, TranslationKeys> = { pl, en, nl, ua };
