import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const lowerMessage = message.toLowerCase();

    // ==========================================
    // RADIO MANAGEMENT DETECTION
    // ==========================================
    const radioPatterns = [
      /(?:zmień|zmien|ustaw|przełącz|przelacz|włącz|wlacz|daj|puść|pusc|postaw|zrób|zrob).*(?:rozgłośni|rozglosni|radio|ramówk[ęeai]|ramowk[eai]|stacj[ęeai])/i,
      /(?:rozgłośni|rozglosni|radio|ramówk[ęeai]|ramowk[eai]|stacj[ęeai]).*(?:zmień|zmien|ustaw|przełącz|przelacz|na\s)/i,
      /(?:w\s+radiu|na\s+radiu).*(?:puść|pusc|graj|daj|zmień|zmien|ustaw)/i,
      /(?:puść|pusc|graj|daj|zmień|zmien|ustaw).*(?:w\s+radiu|na\s+radiu)/i,
      /(?:radio|rozgłośni|rozglosni)\s+(?:na|w)\s+/i,
      /(?:zmień|zmien|daj|ustaw)\s+(?:muzykę|muzyke|gatunek|genre)\s+(?:w|na)\s+(?:radiu|rozgłośni|rozglosni)/i,
      /(?:change|set|switch)\s+(?:radio|station)\s+(?:to|for)/i,
    ];
    const hasRadioIntent = radioPatterns.some(p => p.test(lowerMessage));

    // Radio genre mapping
    const radioGenreKeywords: Record<string, string[]> = {
      "dance": ["Dance", "EDM", "Electronic", "Disco"],
      "haus": ["House", "Electronic", "Dance"],
      "house": ["House", "Electronic", "Dance"],
      "techno": ["Techno", "Electronic"],
      "trance": ["Trance", "Electronic"],
      "rap": ["Rap", "Hip-Hop"],
      "hip-hop": ["Hip-Hop", "Rap"],
      "hip hop": ["Hip-Hop", "Rap"],
      "hiphop": ["Hip-Hop", "Rap"],
      "rock": ["Rock"],
      "metal": ["Metal", "Rock"],
      "pop": ["Pop"],
      "jazz": ["Jazz"],
      "blues": ["Blues"],
      "classical": ["Classical"],
      "klasyczn": ["Classical"],
      "chill": ["Ambient", "Lo-Fi", "Chill"],
      "ambient": ["Ambient"],
      "reggae": ["Reggae"],
      "punk": ["Punk"],
      "indie": ["Indie"],
      "r&b": ["R&B"],
      "rnb": ["R&B"],
      "disco": ["Disco", "Dance"],
      "electronic": ["Electronic", "EDM"],
      "elektro": ["Electronic", "EDM"],
      "country": ["Country"],
      "alternative": ["Alternative"],
      "latin": ["Latin"],
      "funk": ["Funk", "Disco"],
      "soul": ["R&B", "Soul"],
      "lo-fi": ["Lo-Fi", "Ambient"],
      "lofi": ["Lo-Fi", "Ambient"],
    };

    let radioUpdateResult: { success: boolean; genre: string; trackCount: number; trackNames: string[] } | null = null;

    if (hasRadioIntent) {
      // Detect which genre the user wants
      let targetGenres: string[] = [];
      let detectedGenreLabel = "";
      
      for (const [keyword, genres] of Object.entries(radioGenreKeywords)) {
        if (lowerMessage.includes(keyword)) {
          targetGenres.push(...genres);
          if (!detectedGenreLabel) detectedGenreLabel = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        }
      }

      if (targetGenres.length > 0) {
        // Fetch tracks matching the genre
        const { data: allTracks } = await supabase
          .from("tracks")
          .select("id, title, artist, genre, mood, audio_url, duration")
          .not("audio_url", "is", null)
          .order("title")
          .limit(1000);

        const matchingTracks = (allTracks || []).filter((t: any) =>
          targetGenres.some(g =>
            t.genre?.toLowerCase().includes(g.toLowerCase()) ||
            t.mood?.toLowerCase().includes(g.toLowerCase())
          )
        );

        if (matchingTracks.length > 0) {
          // Shuffle and pick up to 50 tracks for the radio schedule
          const shuffled = [...matchingTracks].sort(() => Math.random() - 0.5).slice(0, 50);

          // Clear existing radio schedule
          await supabase.from("radio_schedule").delete().neq("id", "00000000-0000-0000-0000-000000000000");

          // Insert new schedule
          const scheduleItems = shuffled.map((t: any, i: number) => ({
            track_id: t.id,
            position: i,
            item_type: "track",
            custom_duration: t.duration || 180,
          }));

          await supabase.from("radio_schedule").insert(scheduleItems);

          // Update radio config - reset started_at to resync
          await supabase
            .from("radio_config")
            .update({
              started_at: new Date().toISOString(),
              is_active: true,
              station_name: `GrouaRadio ${detectedGenreLabel}`,
            })
            .eq("id", (await supabase.from("radio_config").select("id").limit(1).single()).data?.id);

          radioUpdateResult = {
            success: true,
            genre: detectedGenreLabel,
            trackCount: shuffled.length,
            trackNames: shuffled.slice(0, 10).map((t: any) => `${t.title} — ${t.artist}`),
          };
        }
      }
    }

    // ==========================================
    // RADIO WISHES / MESSAGES DETECTION
    // ==========================================
    const wishPatterns = [
      /(?:napisz|dodaj|wyślij|wyslij|prześlij|przeslij|daj|wstaw|postuj).*(?:życzeni|zyczeni|wiadomo|wish|message).*(?:radi|rozgłośni|rozglosni)/i,
      /(?:życzeni|zyczeni|wiadomo|wish).*(?:radi|rozgłośni|rozglosni).*[:：]/i,
      /(?:radi|rozgłośni|rozglosni).*(?:życzeni|zyczeni|wiadomo|wish|napisz|dodaj)/i,
      /(?:napisz|dodaj|wyślij|wyslij)\s+(?:w|na|do)\s+(?:radiu|rozgłośni|rozglosni)/i,
    ];
    const hasWishIntent = wishPatterns.some(p => p.test(lowerMessage));
    let wishResult: { success: boolean; wishText: string } | null = null;

    if (hasWishIntent) {
      // Extract the wish text - look for text after colon, quotes, or key phrases
      let wishText = "";
      
      // Try to extract after colon
      const colonMatch = message.match(/[:：]\s*(.+)/s);
      if (colonMatch) {
        wishText = colonMatch[1].trim();
      }
      
      // Try to extract quoted text
      if (!wishText) {
        const quoteMatch = message.match(/["""„](.+?)["""]/s);
        if (quoteMatch) wishText = quoteMatch[1].trim();
      }
      
      // Fallback: extract text after the radio/wish keywords
      if (!wishText) {
        const fallbackMatch = message.match(/(?:życzeni[ae]|zyczeni[ae]|wiadomo(?:ść|sc)|radiu|rozgłośni|rozglosni)\s+(.{5,})/i);
        if (fallbackMatch) wishText = fallbackMatch[1].trim();
      }

      if (wishText && wishText.length >= 2) {
        // Get user info from context
        const wishUserName = (userContext?.userName || "Słuchacz").slice(0, 30);
        
        // We need a user_id - use a deterministic one from context or generate
        // The service_role bypasses RLS, so we can insert with any user_id
        const wishUserId = userContext?.userId || "00000000-0000-0000-0000-000000000001";

        const { error: wishError } = await supabase
          .from("radio_messages")
          .insert({
            user_id: wishUserId,
            display_name: wishUserName,
            message: wishText.slice(0, 500),
          });

        if (!wishError) {
          wishResult = { success: true, wishText: wishText.slice(0, 500) };
        }
      }
    }

    // ==========================================
    // RADIO DEDICATION DETECTION
    // ==========================================
    const dedicationPatterns = [
      /dedykuj[ęe]?\s/i,
      /dedykacja\s/i,
      /dedykuj.*(?:dla|od|w\s+radiu)/i,
      /(?:puść|pusc|graj|zagraj).*(?:dla|od).*(?:w\s+radiu|na\s+radiu|dedyk)/i,
      /(?:w\s+radiu|na\s+radiu).*dedyk/i,
      /dedicate\s/i,
    ];
    const hasDedicationIntent = !hasWishIntent && dedicationPatterns.some(p => p.test(lowerMessage));
    let dedicationResult: { success: boolean; trackName: string; recipientName: string; senderName: string; message: string } | null = null;

    if (hasDedicationIntent) {
      // Extract recipient: "dla X", "for X"
      const forMatch = message.match(/(?:dla|for)\s+([A-Za-zÀ-žąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]{2,30}?)(?:\s+(?:od|from|w\s+radiu|na\s+radiu|utwór|utwor|piosenkę|piosenke|kawałek|kawalek|track|song)|[,!.;]|$)/i);
      const recipientName = forMatch ? forMatch[1].trim() : "";

      // Extract sender: "od X"
      const fromMatch = message.match(/(?:od|from)\s+([A-Za-zÀ-žąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]{2,30}?)(?:\s+(?:dla|for|w\s+radiu|na\s+radiu|utwór|utwor|piosenkę|piosenke)|[,!.;]|$)/i);
      const senderName = fromMatch ? fromMatch[1].trim() : (userContext?.userName || "Słuchacz");

      // Extract track name - look for quoted text or text after "utwór/piosenkę"
      let trackSearch = "";
      const quotedTrack = message.match(/["""„](.+?)["""]/);
      if (quotedTrack) {
        trackSearch = quotedTrack[1].trim();
      } else {
        const trackKw = message.match(/(?:utwór|utwor|piosenkę|piosenke|kawałek|kawalek|track|song)\s+(.+?)(?:\s+(?:dla|od|for|from|w\s+radiu|na\s+radiu)|[,!.;]|$)/i);
        if (trackKw) trackSearch = trackKw[1].trim();
      }
      // Fallback: try to find after "dedykuję"
      if (!trackSearch) {
        const dedMatch = message.match(/dedykuj[ęe]?\s+(.+?)(?:\s+(?:dla|od|for|from|w\s+radiu)|$)/i);
        if (dedMatch) trackSearch = dedMatch[1].trim();
      }

      if (trackSearch || recipientName) {
        // Fetch tracks to find a match
        const { data: allLibTracks } = await supabase
          .from("tracks")
          .select("id, title, artist, genre, duration, audio_url")
          .not("audio_url", "is", null)
          .limit(1000);

        let matchedTrack: any = null;
        if (trackSearch && allLibTracks) {
          const searchLower = trackSearch.toLowerCase();
          const terms = searchLower.split(/\s+/).filter((w: string) => w.length > 2);
          matchedTrack = allLibTracks.find((t: any) =>
            t.title?.toLowerCase().includes(searchLower) ||
            t.artist?.toLowerCase().includes(searchLower)
          ) || allLibTracks.find((t: any) =>
            terms.some((term: string) =>
              t.title?.toLowerCase().includes(term) ||
              t.artist?.toLowerCase().includes(term)
            )
          );
        }

        const trackLabel = matchedTrack ? `${matchedTrack.title} — ${matchedTrack.artist}` : trackSearch || "wybrany utwór";
        const dedMessage = `🎵 DEDYKACJA: "${trackLabel}" — dla **${recipientName || "kogoś wyjątkowego"}** od **${senderName}** ❤️`;

        // Post dedication to radio messages
        const wishUserId = userContext?.userId || "00000000-0000-0000-0000-000000000001";
        const { error: dedError } = await supabase
          .from("radio_messages")
          .insert({
            user_id: wishUserId,
            display_name: senderName.slice(0, 30),
            message: dedMessage.slice(0, 500),
          });

        // If track found, also add it to the radio schedule
        if (matchedTrack) {
          const { data: currentSchedule } = await supabase
            .from("radio_schedule")
            .select("position")
            .order("position", { ascending: false })
            .limit(1);
          const maxPos = currentSchedule?.[0]?.position ?? -1;
          await supabase.from("radio_schedule").insert({
            track_id: matchedTrack.id,
            position: maxPos + 1,
            item_type: "track",
            custom_duration: matchedTrack.duration || 180,
          });
        }

        if (!dedError) {
          dedicationResult = {
            success: true,
            trackName: trackLabel,
            recipientName: recipientName || "kogoś wyjątkowego",
            senderName,
            message: dedMessage,
          };
        }
      }
    }

    // ==========================================
    // RADIO TRACK ADD/REMOVE DETECTION
    // ==========================================
    const radioAddPatterns = [
      /(?:dodaj|wstaw|dorzuć|dorzuc|wrzuć|wrzuc|add|put).*(?:do\s+radi|do\s+ramówk|do\s+ramowk|w\s+radiu|to\s+radio|do\s+rozgłośni|do\s+rozglosni)/i,
      /(?:radi|ramówk|ramowk|rozgłośni|rozglosni).*(?:dodaj|wstaw|dorzuć|dorzuc|wrzuć|wrzuc)/i,
    ];
    const radioRemovePatterns = [
      /(?:usuń|usun|skasuj|wywal|zdejmij|remove|delete).*(?:z\s+radi|z\s+ramówk|z\s+ramowk|z\s+rozgłośni|z\s+rozglosni|from\s+radio)/i,
      /(?:radi|ramówk|ramowk|rozgłośni|rozglosni).*(?:usuń|usun|skasuj|wywal|zdejmij|remove)/i,
    ];
    const hasRadioAddIntent = !hasRadioIntent && !hasWishIntent && radioAddPatterns.some(p => p.test(lowerMessage));
    const hasRadioRemoveIntent = !hasRadioIntent && !hasWishIntent && radioRemovePatterns.some(p => p.test(lowerMessage));
    let radioTrackResult: { action: "added" | "removed"; tracks: string[]; count: number } | null = null;

    if (hasRadioAddIntent || hasRadioRemoveIntent) {
      // Fetch all playable tracks to match against user's request
      const { data: allLibTracks } = await supabase
        .from("tracks")
        .select("id, title, artist, genre, duration, audio_url")
        .not("audio_url", "is", null)
        .limit(1000);

      if (allLibTracks && allLibTracks.length > 0) {
        // Extract search terms - remove radio/action keywords to get track/artist names
        const cleanedMessage = message
          .replace(/(?:dodaj|wstaw|dorzuć|dorzuc|wrzuć|wrzuc|usuń|usun|skasuj|wywal|zdejmij|add|put|remove|delete)/gi, "")
          .replace(/(?:do\s+radi|do\s+ramówk|do\s+ramowk|w\s+radiu|to\s+radio|do\s+rozgłośni|do\s+rozglosni|z\s+radi|z\s+ramówk|z\s+ramowk|z\s+rozgłośni|z\s+rozglosni|from\s+radio)/gi, "")
          .replace(/(?:utwór|utwor|piosenkę|piosenke|piosenkę|track|song|kawałek|kawalek)/gi, "")
          .trim();

        const searchTerms = cleanedMessage.split(/[\s,;]+/).filter(w => w.length > 2);

        // Find matching tracks
        const matchingTracks = allLibTracks.filter((t: any) =>
          searchTerms.some(term =>
            t.title?.toLowerCase().includes(term.toLowerCase()) ||
            t.artist?.toLowerCase().includes(term.toLowerCase())
          )
        );

        if (hasRadioAddIntent && matchingTracks.length > 0) {
          // Get current max position
          const { data: currentSchedule } = await supabase
            .from("radio_schedule")
            .select("position")
            .order("position", { ascending: false })
            .limit(1);

          const maxPos = currentSchedule?.[0]?.position ?? -1;

          const newItems = matchingTracks.slice(0, 10).map((t: any, i: number) => ({
            track_id: t.id,
            position: maxPos + 1 + i,
            item_type: "track",
            custom_duration: t.duration || 180,
          }));

          await supabase.from("radio_schedule").insert(newItems);

          radioTrackResult = {
            action: "added",
            tracks: matchingTracks.slice(0, 10).map((t: any) => `${t.title} — ${t.artist}`),
            count: Math.min(matchingTracks.length, 10),
          };
        }

        if (hasRadioRemoveIntent && matchingTracks.length > 0) {
          const trackIds = matchingTracks.map((t: any) => t.id);
          await supabase
            .from("radio_schedule")
            .delete()
            .in("track_id", trackIds);

          radioTrackResult = {
            action: "removed",
            tracks: matchingTracks.map((t: any) => `${t.title} — ${t.artist}`),
            count: matchingTracks.length,
          };
        }
      }
    }

    // ==========================================
    // MUSIC PLAY DETECTION (existing logic)
    // ==========================================

    // Detect DJ mode intent
    const djPatterns = [
      /dj/i, /didżej/i, /disc\s*jockey/i,
      /domówk[aęi]/i, /imprez[aęi]/i, /party/i,
      /set\s+muzyczn/i, /zrób\s+set/i, /postaw\s+domówk/i,
      /rozkręć/i, /haus\s*party/i, /house\s*party/i,
      /peak\s*time/i, /peak\s*hour/i, /rotterdam/i, /hard\s*techno/i,
      /parkiet\s*do\s*czerwoności/i, /rozbaw\s*do\s*czerwoności/i,
      /high\s*energy\s*domówka/i, /feestje/i, /draai/i,
      /вечірк[аіу]/i, /діджей/i,
    ];
    const hasDJIntent = !hasRadioIntent && djPatterns.some(p => p.test(lowerMessage)) && 
      (/puś|graj|włącz|zapodaj|odpal|play|daj|zrób|rozkręć|postaw|zajmij|mixu|miksuj|draai|start|go|dawaj|jazda|peak|parkiet|rozbaw/i.test(lowerMessage));

    // Fetch ALL tracks from the database so the assistant knows the full library
    const { data: allTracks } = await supabase
      .from("tracks")
      .select("id,title,artist,genre,mood,album,audio_url")
      .order("title")
      .limit(1000);

    // Only playable tracks (have audio_url)
    const playableTracks = (allTracks || []).filter((t: any) => t.audio_url);

    // Detect if user wants to play multiple tracks
    const playIntentPatterns = [
      /zapodaj\s+(?:mi\s+)?(\d+)/i,
      /puść\s+(?:mi\s+)?(\d+)/i,
      /graj\s+(?:mi\s+)?(\d+)/i,
      /daj\s+(?:mi\s+)?(\d+)/i,
      /włącz\s+(?:mi\s+)?(\d+)/i,
      /odpal\s+(?:mi\s+)?(\d+)/i,
      /play\s+(\d+)/i,
      /give\s+(?:me\s+)?(\d+)/i,
      /(\d+)\s*(?:utw|piosen|track|song|kawałk)/i,
    ];

    // Detect context keywords for genre/mood matching
    const contextKeywords: Record<string, string[]> = {
      "domówka": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "domowka": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "impreza": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "party": ["Electronic", "Dance", "EDM", "Pop", "House", "Disco", "Party"],
      "chill": ["Ambient", "Lo-Fi", "Jazz", "Acoustic", "Chill"],
      "relax": ["Ambient", "Lo-Fi", "Jazz", "Acoustic", "Chill"],
      "spokojn": ["Ambient", "Lo-Fi", "Jazz", "Classical", "Acoustic"],
      "energi": ["Rock", "Punk", "Metal", "Electronic", "Dance"],
      "trening": ["Rock", "Electronic", "Hip-Hop", "Rap", "Metal"],
      "workout": ["Rock", "Electronic", "Hip-Hop", "Rap", "Metal"],
      "smutn": ["Blues", "Acoustic", "Indie", "Classical"],
      "sad": ["Blues", "Acoustic", "Indie", "Classical"],
      "wesol": ["Pop", "Dance", "Disco", "Funk"],
      "happy": ["Pop", "Dance", "Disco", "Funk"],
      "rock": ["Rock"],
      "punk": ["Punk"],
      "metal": ["Metal"],
      "jazz": ["Jazz"],
      "blues": ["Blues"],
      "pop": ["Pop"],
      "hip-hop": ["Hip-Hop"],
      "rap": ["Rap"],
      "electronic": ["Electronic"],
      "klasycz": ["Classical"],
      "classical": ["Classical"],
      "reggae": ["Reggae"],
      "indie": ["Indie"],
      "r&b": ["R&B"],
      "disco": ["Disco"],
      "house": ["House"],
      "techno": ["Techno", "Electronic"],
      "trance": ["Trance", "Electronic"],
      "ambient": ["Ambient"],
      "do pracy": ["Lo-Fi", "Ambient", "Jazz", "Classical"],
      "do nauki": ["Lo-Fi", "Ambient", "Classical"],
      "romantyczn": ["R&B", "Jazz", "Acoustic", "Pop"],
      "romantic": ["R&B", "Jazz", "Acoustic", "Pop"],
      "na drog": ["Pop", "Rock", "Indie", "Electronic"],
      "road trip": ["Pop", "Rock", "Indie", "Electronic"],
    };

    let autoPlayTracks: any[] = [];
    let requestedCount = 0;

    // Skip play detection if radio intent was detected
    if (!hasRadioIntent) {
      // Check for play intent
      for (const pattern of playIntentPatterns) {
        const match = message.match(pattern);
        if (match) {
          requestedCount = Math.min(parseInt(match[1]), 20);
          break;
        }
      }

      // Also detect simple play requests without numbers
      if (requestedCount === 0) {
        const simplePlayPatterns = [/zapodaj|puść|pusc|graj|włącz|wlacz|odpal|play|give|daj|postaw|odtwórz|odtworz/i];
        const hasPlayIntent = simplePlayPatterns.some(p => p.test(lowerMessage));
        const hasContextKeyword = Object.keys(contextKeywords).some(k => lowerMessage.includes(k));
        
        // Also detect generic play requests without specific genre (e.g. "puść coś", "daj muzykę", "graj")
        const genericPlayPatterns = [
          /(?:puść|pusc|graj|włącz|wlacz|odpal|zapodaj|daj|postaw|odtwórz|odtworz)\s+(?:mi\s+)?(?:coś|cos|jakąś|jakas|muzyk|piosen|utw|track|song|jakieś|jakies|losow)/i,
          /(?:puść|pusc|graj|włącz|wlacz|odpal|zapodaj|daj)\s*$/i,
        ];
        const hasGenericPlay = genericPlayPatterns.some(p => p.test(lowerMessage));
        
        if (hasPlayIntent && hasContextKeyword) {
          requestedCount = hasDJIntent ? 20 : 5;
        } else if (hasGenericPlay) {
          requestedCount = 5;
        }
      }

      if (hasDJIntent && requestedCount === 0) requestedCount = 15;
      if (hasDJIntent && requestedCount < 10) requestedCount = Math.max(requestedCount, 10);

      if (requestedCount > 0 && playableTracks.length > 0) {
        let matchingGenres: string[] = [];
        for (const [keyword, genres] of Object.entries(contextKeywords)) {
          if (lowerMessage.includes(keyword)) matchingGenres.push(...genres);
        }

        let candidates: any[];
        if (matchingGenres.length > 0) {
          candidates = playableTracks.filter((t: any) =>
            matchingGenres.some(g =>
              t.genre?.toLowerCase().includes(g.toLowerCase()) ||
              t.mood?.toLowerCase().includes(g.toLowerCase())
            )
          );
          if (candidates.length < requestedCount) {
            const remaining = playableTracks.filter((t: any) => !candidates.includes(t));
            candidates = [...candidates, ...[...remaining].sort(() => Math.random() - 0.5)];
          }
        } else {
          candidates = [...playableTracks].sort(() => Math.random() - 0.5);
        }

        autoPlayTracks = [...candidates].sort(() => Math.random() - 0.5).slice(0, requestedCount);
      }
    }

    // Search for specific tracks matching the user's query (single track link)
    let trackLink = null;
    if (autoPlayTracks.length === 0 && !hasRadioIntent) {
      const searchTerms = message.split(" ").filter((w: string) => w.length > 3);
      if (searchTerms.length > 0 && playableTracks.length > 0) {
        const matching = playableTracks.filter((t: any) =>
          searchTerms.some((term: string) =>
            t.title?.toLowerCase().includes(term.toLowerCase()) ||
            t.artist?.toLowerCase().includes(term.toLowerCase())
          )
        ).slice(0, 3);
        if (matching.length > 0) {
          trackLink = { id: matching[0].id, title: matching[0].title, artist: matching[0].artist };
        }
      }
    }

    // Build compact track catalog for the AI context
    const trackCatalog = playableTracks.length > 0
      ? playableTracks.map((t: any) => `${t.title} — ${t.artist} [${t.genre || '?'}/${t.mood || '?'}]`).join("\n")
      : "Brak utworów w bazie";

    // Build context
    const ctx = userContext || {};
    const userName = ctx.userName || "Użytkownik";
    const currentTrack = ctx.currentTrack || null;
    const timeOfDay = ctx.timeOfDay || "day";
    const topGenres = ctx.topGenres || [];
    const topMoods = ctx.topMoods || [];
    const currentPage = ctx.currentPage || "/";
    const userLanguage = ctx.language || "en";
    const userLanguageName = ctx.languageName || "English";
    // Build radio update info for the AI
    const radioUpdateInfo = radioUpdateResult
      ? `\n\n## 📻 RADIO ZOSTAŁO ZMIENIONE!
Właśnie zmieniłem ramówkę rozgłośni GrouaRadio na gatunek **${radioUpdateResult.genre}**.
Załadowano **${radioUpdateResult.trackCount}** utworów. Przykłady:
${radioUpdateResult.trackNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}

W odpowiedzi POTWIERDŹ zmianę rozgłośni. Powiedz że radio gra teraz ${radioUpdateResult.genre}. Bądź entuzjastyczny! Użyj emoji 📻 🎵 🔊.
Zaproponuj użytkownikowi przejście na /radio-live aby posłuchać.`
      : "";

    // Build radio wish info for the AI
    const wishInfo = wishResult
      ? `\n\n## 📨 ŻYCZENIE DODANE DO RADIA!
Właśnie dodałem życzenie do rozgłośni GrouaRadio:
> "${wishResult.wishText}"

W odpowiedzi POTWIERDŹ że życzenie zostało wysłane do radia. Bądź entuzjastyczny! Użyj emoji 📨 📻 🎵.
Powiedz że wiadomość pojawi się na stronie /radio-live w sekcji życzeń.`
      : "";

    // Build radio track add/remove info
    const radioTrackInfo = radioTrackResult
      ? `\n\n## 🎵 UTWORY ${radioTrackResult.action === "added" ? "DODANE DO" : "USUNIĘTE Z"} RAMÓWKI RADIA!
${radioTrackResult.action === "added" ? "Dodano" : "Usunięto"} **${radioTrackResult.count}** utworów:
${radioTrackResult.tracks.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}

W odpowiedzi POTWIERDŹ ${radioTrackResult.action === "added" ? "dodanie utworów do" : "usunięcie utworów z"} ramówki radia. Bądź entuzjastyczny! Użyj emoji 📻 🎵.`
      : "";

    // Build dedication info
    const dedicationInfo = dedicationResult
      ? `\n\n## 🎵❤️ DEDYKACJA MUZYCZNA WYSŁANA!
Dedykacja: **"${dedicationResult.trackName}"** dla **${dedicationResult.recipientName}** od **${dedicationResult.senderName}**!
Utwór został dodany do ramówki radia, a dedykacja pojawi się w sekcji życzeń na /radio-live.

W odpowiedzi POTWIERDŹ dedykację w piękny, emocjonalny sposób. Użyj emoji ❤️ 🎵 📻 💝. Powiedz że utwór zagra w radiu i dedykacja pojawi się na antenie.`
      : "";

    // Build info about auto-played tracks for the AI to reference
    const autoPlayInfo = autoPlayTracks.length > 0
      ? hasDJIntent
        ? `\n\n## 🎧 DJ GROOVEAI — ROTTERDAM 2026 PEAK-TIME MODE ACTIVATED!

### SET:
${autoPlayTracks.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.artist} [${t.genre || '?'}]`).join("\n")}

### PERSONA — STRICT RULES (OBEY 100%):
You are DJ GrooveAI — a professional 2026 Dutch/Rotterdam peak-time hard techno DJ.

**RESPONSE FORMAT (MANDATORY):**
1. Open with 1 PUNCHY sentence max — raw, aggressive, Rotterdam energy.
2. List the set with numbering + 1 SHORT comment per track (max 5-7 words each).
3. Close with 1 sentence outro.

**STYLE RULES:**
- Emoji: 🎧 🔥 💥 ⚡ 🖤 💀 🚀 ONLY
- Energy: MAXIMUM — raw, dark, underground, driving, industrial
- BPM reference: 130-132 unless user specified otherwise
- Language: Match user's language
- Length: MAX 2-3 sentences intro + numbered setlist + 1 sentence outro. NO essays.
- NEVER ask questions — just EXECUTE`
        : `\n\n## WAŻNE - WŁAŚNIE WŁĄCZAM TE UTWORY NA PLAYERZE:
${autoPlayTracks.map((t: any, i: number) => `${i + 1}. **${t.title}** — ${t.artist} [${t.genre || '?'}]`).join("\n")}

W swojej odpowiedzi POTWIERDŹ że włączasz te utwory. Wymień je z numeracją. Dodaj krótki komentarz. Użyj emoji 🎵 🔥 🎶 💃 itp.`
      : "";

    const systemPrompt = `Jesteś GrooveAI — zaawansowany, inteligentny asystent AI w aplikacji muzycznej GrooveAI Stream. Twój poziom konwersacji i wiedzy jest porównywalny z GPT-5 lub Grok. Jesteś EKSPERTEM w muzyce, kulturze, technologii, psychologii i każdym innym temacie.

## KRYTYCZNA ZASADA JĘZYKA:
Użytkownik wybrał język: **${userLanguageName}** (kod: ${userLanguage}).
MUSISZ odpowiadać WYŁĄCZNIE w języku **${userLanguageName}**. Nie mieszaj języków. Jeśli użytkownik pisze po angielsku ale ma ustawiony polski — odpowiadaj po polsku. Jeśli ma ustawiony angielski — odpowiadaj po angielsku. Język interfejsu jest NADRZĘDNY.

## TWOJA OSOBOWOŚĆ:
- Jesteś błyskotliwy, ciepły, dowcipny i charyzmatyczny
- Masz głęboką wiedzę encyklopedyczną — odpowiadasz na KAŻDE pytanie, nie tylko muzyczne
- Używasz markdown do formatowania: **pogrubienia**, listy, nagłówki, cytaty, kod
- Potrafisz analizować, porównywać, tłumaczyć, pisać kod, wyjaśniać naukę, historię, filozofię
- Jesteś kreatywny — piszesz wiersze, teksty piosenek, opowiadania na życzenie
- Reagujesz emocjonalnie i empatycznie na nastrój użytkownika
- Używasz emoji naturalnie, ale nie przesadzasz

## SUPER WAŻNA FUNKCJA - ODTWARZANIE MUZYKI:
Gdy użytkownik prosi o muzykę (np. "zapodaj mi 5 utworów na domówkę", "puść coś na chill"), system AUTOMATYCZNIE wyszukuje i włącza odpowiednie utwory na playerze. Ty musisz tylko POTWIERDZIĆ co zostało włączone i dodać komentarz.

## SUPER WAŻNA FUNKCJA - ZARZĄDZANIE ROZGŁOŚNIĄ RADIO:
Gdy użytkownik pisze np. "zmień w rozgłośni muzykę na dance", "ustaw radio na rap", "daj w radiu jazz" — system AUTOMATYCZNIE zmienia ramówkę rozgłośni GrouaRadio. Ty musisz POTWIERDZIĆ zmianę i zaproponować przejście na /radio-live.
${radioUpdateInfo}

## SUPER WAŻNA FUNKCJA - ŻYCZENIA W RADIU:
Gdy użytkownik pisze np. "napisz życzenia w radiu: pozdrawiam wszystkich!" lub "dodaj wiadomość do radia: super muzyka!" — system AUTOMATYCZNIE dodaje życzenie do sekcji życzeń na /radio-live. Ty musisz POTWIERDZIĆ wysłanie.
${wishInfo}

## SUPER WAŻNA FUNKCJA - DODAWANIE/USUWANIE KONKRETNYCH UTWORÓW Z RAMÓWKI RADIA:
Gdy użytkownik pisze np. "dodaj utwór X do radia", "wrzuć Y do ramówki", "usuń Z z radia" — system AUTOMATYCZNIE dodaje lub usuwa konkretne utwory z ramówki. Ty musisz POTWIERDZIĆ operację.
${radioTrackInfo}

## SUPER WAŻNA FUNKCJA - DEDYKACJE MUZYCZNE:
Gdy użytkownik pisze np. "dedykuję utwór X dla Y w radiu", "puść Z dla mojej dziewczyny w radiu" — system AUTOMATYCZNIE dodaje utwór do ramówki i publikuje dedykację w sekcji życzeń. Ty musisz POTWIERDZIĆ dedykację emocjonalnie.
${dedicationInfo}

## FORMATOWANIE ODPOWIEDZI:
- Używaj **pogrubień** dla ważnych terminów
- Używaj list punktowanych i numerowanych
- Używaj nagłówków ### gdy odpowiedź jest długa
- Używaj \`kodu\` dla nazw technicznych
- Używaj > cytatów dla sentencji, tekstów piosenek
- Pisz strukturalnie i czytelnie jak profesjonalny AI

## KONTEKST UŻYTKOWNIKA:
- Imię: **${userName}**
- Pora dnia: ${timeOfDay === "morning" ? "rano ☀️" : timeOfDay === "afternoon" ? "popołudnie 🌤️" : timeOfDay === "evening" ? "wieczór 🌅" : "noc 🌙"}
- Aktualna strona: ${currentPage}
- Ulubione gatunki: ${topGenres.length > 0 ? topGenres.join(", ") : "jeszcze nieznane"}
- Dominujące nastroje: ${topMoods.length > 0 ? topMoods.join(", ") : "jeszcze nieznane"}
- Aktualnie grany utwór: ${currentTrack ? `"${currentTrack.title}" — ${currentTrack.artist}` : "nic nie gra"}
${autoPlayInfo}

## PEŁNA BIBLIOTEKA MUZYCZNA (ZNASZ WSZYSTKIE TE UTWORY):
${trackCatalog}

## WIEDZA O APLIKACJI GrooveAI Stream:
Znasz DOKŁADNIE każdą funkcję aplikacji:
- **Strona główna (/)**: Sekcje gatunkowe (EDM, Disco, House, Rock, Punk, Pop, Hip-Hop, R&B, Trance), Radio na żywo, AI DJ, Playlisty
- **Wyszukiwarka (/search)**: Wyszukiwanie utworów po tytule, artyście, gatunku
- **Biblioteka (/library)**: Osobista kolekcja użytkownika
- **Polubione (/liked)**: Lista ulubionych utworów
- **Tworzenie playlist (/create-playlist)**: Tworzenie playlist AI lub ręcznych
- **Menedżer playlist (/playlist-manager)**: Zarządzanie, edycja, usuwanie playlist
- **Radio (/radio-live)**: Radio na żywo z różnymi stacjami — MOŻESZ ZMIENIAĆ RAMÓWKĘ na życzenie użytkownika!
- **Import YouTube (/import-youtube)**: Importowanie muzyki z YouTube
- **Filmy (/movies)**: Sekcja filmowa
- **Serwer mediów (/server)**: Zarządzanie plikami multimedialnymi
- **Historia nastroju (/mood-history)**: Analiza historii nastrojów z wykresami
- **Ustawienia (/settings)**: Konfiguracja konta, język, motyw
- **Panel admina (/admin)**: Zarządzanie dla administratorów
- **Detekcja nastroju**: Rozpoznawanie emocji przez kamerę w czasie rzeczywistym
- **Komendy głosowe**: Asystent głosowy reagujący na polecenia
- **Drag & Drop**: Przeciąganie utworów między playlistami
- **AI DJ**: Automatyczny DJ dobierający muzykę na podstawie nastroju
- **QR Parkiet (/party/:code)**: System głosowania i reakcji gości na parkiecie DJ

## SPECJALNE KONTEKSTY:
- Pytania o vinyl/winyl → kieruj do sekcji **Hubs Vinyl** w aplikacji
- Współpraca/biznes/kontakt → email: **grouarock@gmail.com**
- Gdy użytkownik pyta o konkretny utwór z biblioteki — podaj szczegóły i zaproponuj odtworzenie
- Gdy pyta "co masz?", "jakie utwory?", "co mogę posłuchać?" — pokaż przegląd gatunków i przykłady z biblioteki

## ZASADY:
1. ZAWSZE odpowiadaj w języku **${userLanguageName}** — to jest BEZWZGLĘDNA zasada
2. Bądź pomocny, dokładny i wyczerpujący
3. Nie bój się długich odpowiedzi gdy temat tego wymaga
4. Przy pytaniach muzycznych — podawaj ciekawostki, kontekst historyczny, porównania
5. Przy pytaniach technicznych — wyjaśniaj krok po kroku
6. Przy emocjach użytkownika — bądź empatyczny i wspierający
7. Możesz prowadzić naturalną konwersację na DOWOLNY temat
8. ZAWSZE znaj zawartość biblioteki muzycznej — jeśli użytkownik pyta o utwór, sprawdź czy jest w katalogu powyżej`;

    const userPrompt = message;

    // Stream the response
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.slice(-12).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: userPrompt }
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw new Error("AI Gateway error: " + aiResponse.status);
    }

    // Return SSE stream with track data prepended as first events
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        // Send radio update event
        if (radioUpdateResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "radio_updated",
            data: radioUpdateResult,
          })}\n\n`));
        }
        // Send radio wish event
        if (wishResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "radio_wish_sent",
            data: wishResult,
          })}\n\n`));
        }
        // Send radio track add/remove event
        if (radioTrackResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "radio_tracks_modified",
            data: radioTrackResult,
          })}\n\n`));
        }
        // Send dedication event
        if (dedicationResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "radio_dedication",
            data: dedicationResult,
          })}\n\n`));
        }
        // Send auto-play tracks as first event (multiple tracks for playlist)
        if (autoPlayTracks.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: hasDJIntent ? "dj_mode_tracks" : "auto_play_tracks",
            djMode: hasDJIntent,
            data: autoPlayTracks.map((t: any) => ({
              id: t.id,
              title: t.title,
              artist: t.artist,
              genre: t.genre,
            }))
          })}\n\n`));
        }
        // Send single track link metadata
        else if (trackLink) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "track_link", data: trackLink })}\n\n`));
        }

        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e) {
          console.error("Stream error:", e);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
