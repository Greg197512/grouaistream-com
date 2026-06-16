import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_AI_MODEL = "google/gemini-3-flash-preview";

const lovableAiHeaders = (apiKey: string) => ({
  "Lovable-API-Key": apiKey,
  "X-Lovable-AIG-SDK": "raw-openai-compatible",
  "Content-Type": "application/json",
});

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Optional Authentication ---
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    let authenticatedUserId: string | null = null;
    
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await supabaseAuthClient.auth.getUser();
        if (userData?.user) {
          authenticatedUserId = userData.user.id;
        }
      } catch {
        // Auth failed — continue as anonymous
      }
    }
    // --- End authentication ---

    const { message, history: rawHistory, userContext, attachments } = await req.json();
    const history = Array.isArray(rawHistory) ? rawHistory : [];

    // API keys — Lovable AI is the primary provider for the assistant
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    const GROK_API_KEY = Deno.env.get("GROK_API_KEY") || Deno.env.get("OPENROUTER_API_KEY") || "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

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
    // MUSIC GENERATION DETECTION (GrouAI Studio)
    // ==========================================
    const generatePatterns = [
      /(?:wygeneruj|stwórz|stworz|zrób|zrob|skomponuj|napisz|nagraj|create|generate|make|compose|produc|nagrywaj|wyprodukuj|zmasteruj).*(?:utw[oó]r|piosen[kę]|piosenke|track|beat|muzyk[ęe]|song|bit|melodię|melodie|remix|mix|set|drop|hook|intro|outro)/i,
      /(?:utw[oó]r|piosen[kę]|piosenke|track|beat|muzyk[ęe]|song|bit|melodię|melodie).*(?:wygeneruj|stwórz|stworz|zrób|zrob|skomponuj)/i,
      /(?:chc[ęe]|chciałbym|chcialbym|potrzebuj[ęe]|daj|zrób|zrob|make me|i want|i need).*(?:now[yąa]|now[ąa]|swoj|swój|taki|jak[iąa]ś|własn).*(?:utw[oó]r|piosen[kę]|piosenke|track|beat|muzyk[ęe]|song)/i,
      /(?:zrób|zrob|stwórz|stworz|daj)\s+(?:mi\s+)?(?:coś|cos)\s+(?:w\s+stylu|jak|podobn)/i,
      /(?:chcę|chce)\s+(?:żeby|zeby)?\s*(?:brzmiał|brzmial|grał|gral|był|byl)\s+(?:jak|w\s+stylu)/i,
      /(?:wyprodukuj|produc|nagraj)\s/i,
      /(?:zrób|zrob|stwórz|stworz)\s+(?:mi\s+)?(?:bit|beat|drop|hook|bass\s*line|melodię|melodie|riff)/i,
    ];
    const hasGenerateIntent = !hasRadioIntent && !hasWishIntent && !hasDedicationIntent && !hasRadioAddIntent && !hasRadioRemoveIntent && generatePatterns.some(p => p.test(lowerMessage));
    let generateResult: { style: string; style2?: string; blendRatio?: number; instrumental: boolean; title?: string; mood?: string; energy?: string; tempoOverride?: number; prompt: string } | null = null;

    if (hasGenerateIntent) {
      // Use AI to parse the complex prompt into generation parameters
      if (LOVABLE_API_KEY) {
        try {
          const parseResponse = await fetch(LOVABLE_AI_CHAT_URL, {
            method: "POST",
            headers: lovableAiHeaders(LOVABLE_API_KEY),
            body: JSON.stringify({
              model: LOVABLE_AI_MODEL,
            messages: [
              { role: "system", content: `You are a music production AI that parses user prompts into generation parameters. Analyze the user's request and extract parameters. Available styles: Pop, Rock, Electronic, Hip-Hop, Jazz, Classical, Lo-fi, Ambient, Metal, R&B, Reggae, Trap, House, Disco, Indie, Country. Available moods: dark, bright, melancholic, euphoric, aggressive, dreamy, romantic, tense. Available energy: low, medium, high, extreme.` },
              { role: "user", content: message },
            ],
            tools: [{
              type: "function",
              function: {
                name: "set_music_params",
                description: "Set music generation parameters based on user's prompt",
                parameters: {
                  type: "object",
                  properties: {
                    style: { type: "string", description: "Primary music style/genre" },
                    style2: { type: "string", description: "Secondary style for blending (optional)" },
                    blendRatio: { type: "number", description: "Blend ratio 0-1 (optional, default 0.5)" },
                    mood: { type: "string", enum: ["dark", "bright", "melancholic", "euphoric", "aggressive", "dreamy", "romantic", "tense"] },
                    energy: { type: "string", enum: ["low", "medium", "high", "extreme"] },
                    instrumental: { type: "boolean", description: "True if no vocals/lyrics requested" },
                    title: { type: "string", description: "Suggested title based on the prompt" },
                    tempoOverride: { type: "number", description: "Specific BPM if user requested (optional)" },
                  },
                  required: ["style", "mood", "energy", "instrumental", "title"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "set_music_params" } },
          }),
          });

          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            const toolCall = parseData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              const params = JSON.parse(toolCall.function.arguments);
              generateResult = {
                style: params.style || "Pop",
                style2: params.style2 || undefined,
                blendRatio: params.blendRatio || undefined,
                instrumental: params.instrumental ?? false,
                title: params.title || undefined,
                mood: params.mood || undefined,
                energy: params.energy || undefined,
                tempoOverride: params.tempoOverride || undefined,
                prompt: message,
              };
            }
          } else {
            console.error("Lovable AI prompt parsing error:", parseResponse.status, await parseResponse.text());
          }
        } catch (parseErr) {
          console.error("AI prompt parsing error:", parseErr);
        }
      }

      // Fallback: basic keyword detection if AI parsing failed
      if (!generateResult) {
        const styleKeywords: Record<string, string> = {
          "pop": "Pop", "rock": "Rock", "electronic": "Electronic", "elektroniczn": "Electronic",
          "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", "hiphop": "Hip-Hop", "rap": "Hip-Hop",
          "jazz": "Jazz", "classical": "Classical", "klasyczn": "Classical",
          "r&b": "R&B", "rnb": "R&B", "country": "Country", "reggae": "Reggae",
          "metal": "Metal", "indie": "Indie", "lo-fi": "Lo-fi", "lofi": "Lo-fi",
          "ambient": "Ambient", "trap": "Trap", "house": "House", "disco": "Disco",
        };
        let detectedStyle = "Pop";
        for (const [kw, style] of Object.entries(styleKeywords)) {
          if (lowerMessage.includes(kw)) { detectedStyle = style; break; }
        }
        const isInstrumental = /instrumental|bez\s+(?:wokalu|głosu|tekstu|słów)/i.test(lowerMessage);
        const titleMatch = message.match(/["""„](.+?)["""]/);
        generateResult = {
          style: detectedStyle,
          instrumental: isInstrumental,
          title: titleMatch ? titleMatch[1].trim() : undefined,
          prompt: message,
        };
      }
    }

    // ==========================================
    // AUDIO MIXING DETECTION
    // ==========================================
    const audioAttachments = (attachments || []).filter((a: any) => a.type === "audio");
    const hasMixIntent = /miksuj|zmixuj|zmiksuj|mixuj|połącz|polacz|blend|merge|mashup|mix\s+(?:te|to|these)|zrób\s+mix|zrob\s+mix|zmieszaj/i.test(lowerMessage);
    let mixRequest: { urls: string[]; style: string } | null = null;

    if (hasMixIntent && audioAttachments.length >= 2) {
      const mixStyleMatch = lowerMessage.match(/crossfade|overlay|mashup|nakładk|nakladk/i);
      let style = "crossfade";
      if (mixStyleMatch) {
        const s = mixStyleMatch[0].toLowerCase();
        if (s === "overlay" || s.startsWith("nakładk") || s.startsWith("nakladk")) style = "overlay";
        if (s === "mashup") style = "mashup";
      }
      mixRequest = {
        urls: audioAttachments.slice(0, 2).map((a: any) => a.url),
        style,
      };
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
      .select("id,title,artist,genre,mood,album,audio_url,created_at")
      .order("title")
      .limit(1000);

    // Only playable tracks (have audio_url)
    const playableTracks = (allTracks || []).filter((t: any) => t.audio_url);

    // ==========================================
    // FETCH USER-SPECIFIC DATA (favorites, recent, playlists, AI preferences)
    // ==========================================
    const userId = (userContext as any)?.userId;
    let userFavorites: any[] = [];
    let userListeningHistory: any[] = [];
    let userPlaylistsData: any[] = [];
    let userPreferences: any = null;

    // Recent uploads (newest tracks in DB)
    const recentUploads = [...(allTracks || [])]
      .filter((t: any) => t.audio_url)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    if (userId) {
      // Fetch AI-learned preferences
      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (prefsData) userPreferences = prefsData;

      // Fetch favorites (liked songs)
      const { data: likedData } = await supabase
        .from("liked_songs")
        .select("track_id, liked_at")
        .eq("user_id", userId)
        .order("liked_at", { ascending: false })
        .limit(50);

      if (likedData && likedData.length > 0) {
        const likedIds = likedData.map((l: any) => l.track_id);
        userFavorites = playableTracks
          .filter((t: any) => likedIds.includes(t.id))
          .map((t: any) => {
            const likeEntry = likedData.find((l: any) => l.track_id === t.id);
            return { ...t, liked_at: likeEntry?.liked_at };
          });
      }

      // Fetch listening history (recently played)
      const { data: historyData } = await supabase
        .from("listening_history")
        .select("track_id, played_at")
        .eq("user_id", userId)
        .order("played_at", { ascending: false })
        .limit(50);

      if (historyData && historyData.length > 0) {
        const seenIds = new Set<string>();
        const uniqueHistory = historyData.filter((h: any) => {
          if (seenIds.has(h.track_id)) return false;
          seenIds.add(h.track_id);
          return true;
        });
        userListeningHistory = playableTracks
          .filter((t: any) => uniqueHistory.some((h: any) => h.track_id === t.id))
          .map((t: any) => {
            const histEntry = uniqueHistory.find((h: any) => h.track_id === t.id);
            return { ...t, played_at: histEntry?.played_at };
          })
          .sort((a: any, b: any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime());
      }

      // Fetch user playlists with tracks
      const { data: plData } = await supabase
        .from("playlists")
        .select("id, title")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (plData) {
        for (const pl of plData) {
          const { data: ptData } = await supabase
            .from("playlist_tracks")
            .select("track_id")
            .eq("playlist_id", pl.id)
            .order("position")
            .limit(50);
          const trackIds = (ptData || []).map((pt: any) => pt.track_id);
          const plTracks = playableTracks.filter((t: any) => trackIds.includes(t.id));
          userPlaylistsData.push({ ...pl, tracks: plTracks });
        }
      }
    }

    // ==========================================
    // PLAYLIST TRACK MOVE/TRANSFER DETECTION
    // ==========================================
    const movePatterns = [
      /(?:przenieś|przenies|wytnij|przesuń|przesun|dodaj|wrzuć|wrzuc|move|transfer|cut).*(?:do\s+(?:katalogu|playlisty|folderu)|to\s+(?:playlist|folder|catalog))/i,
      /(?:usuń|usun|wywal|skasuj|remove|delete).*(?:z\s+(?:katalogu|playlisty|folderu)|from\s+(?:playlist|folder))/i,
    ];
    const hasMoveIntent = !hasRadioIntent && !hasWishIntent && !hasDedicationIntent && !hasRadioAddIntent && !hasRadioRemoveIntent && !hasGenerateIntent && movePatterns.some(p => p.test(lowerMessage));
    let moveResult: { action: string; trackName: string; playlistName: string; success: boolean } | null = null;

    if (hasMoveIntent && userId) {
      const trackMatch = message.match(/(?:utwór|utwor|piosenkę|piosenke|track|song|kawałek|kawalek)\s+["""„]?(.+?)[""""]?\s+(?:do|z|from|to)/i) ||
        message.match(/(?:przenieś|przenies|wytnij|dodaj|wrzuć|wrzuc|usuń|usun)\s+["""„]?(.+?)[""""]?\s+(?:do|z|from|to)/i);
      const playlistMatch = message.match(/(?:do|z|from|to)\s+(?:katalogu|playlisty|folderu|playlist|folder)\s+["""„]?(.+?)[""""]?(?:\s|$|[,!.])/i);

      if (trackMatch && playlistMatch) {
        const trackSearch = trackMatch[1].trim();
        const playlistSearch = playlistMatch[1].trim();

        const matchedTrack = (allTracks || []).find((t: any) =>
          t.title?.toLowerCase().includes(trackSearch.toLowerCase()) ||
          t.artist?.toLowerCase().includes(trackSearch.toLowerCase())
        );

        const { data: matchedPlaylist } = await supabase
          .from("playlists")
          .select("id, title")
          .eq("user_id", userId)
          .ilike("title", `%${playlistSearch}%`)
          .limit(1)
          .maybeSingle();

        if (matchedTrack && matchedPlaylist) {
          const isRemove = /usuń|usun|wywal|skasuj|wytnij|remove|delete/i.test(lowerMessage);

          if (isRemove) {
            await supabase.from("playlist_tracks").delete()
              .eq("playlist_id", matchedPlaylist.id)
              .eq("track_id", matchedTrack.id);
            moveResult = { action: "removed", trackName: `${matchedTrack.title} — ${matchedTrack.artist}`, playlistName: matchedPlaylist.title, success: true };
          } else {
            const { data: existing } = await supabase.from("playlist_tracks")
              .select("id").eq("playlist_id", matchedPlaylist.id).eq("track_id", matchedTrack.id).maybeSingle();

            if (!existing) {
              const { data: maxPos } = await supabase.from("playlist_tracks")
                .select("position").eq("playlist_id", matchedPlaylist.id)
                .order("position", { ascending: false }).limit(1);
              const nextPos = (maxPos?.[0]?.position ?? -1) + 1;
              await supabase.from("playlist_tracks").insert({
                playlist_id: matchedPlaylist.id,
                track_id: matchedTrack.id,
                position: nextPos,
              });
            }
            moveResult = { action: "added", trackName: `${matchedTrack.title} — ${matchedTrack.artist}`, playlistName: matchedPlaylist.title, success: true };
          }
        }
      }
    }

    // Detect if user wants to play multiple tracks
    const playIntentPatterns = [
      /(?:zapodaj|pu[sśćcz]{1,3}|posc|graj|daj|w[lł][aą][cć]z|odpal|play|give)\s+(?:mi\s+)?(\d+)/i,
      /(\d+)\s*(?:utw|piosen|track|song|kawałk|numer)/i,
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
        const simplePlayPatterns = [/zapodaj|pu[sśćcz]{1,3}|posc|graj|w[lł][aą][cć]z|wlacz|odpal|play|give|daj|postaw|odtw[oó]rz|odtworz/i];
        const hasPlayIntent = simplePlayPatterns.some(p => p.test(lowerMessage));
        const hasContextKeyword = Object.keys(contextKeywords).some(k => lowerMessage.includes(k));
        
        // Also detect generic play requests without specific genre (e.g. "puść coś", "daj muzykę", "graj")
        const genericPlayPatterns = [
          /(?:pu[sśćcz]{1,3}|posc|graj|w[lł][aą][cć]z|wlacz|odpal|zapodaj|daj|postaw|odtw[oó]rz|odtworz)\s+(?:mi\s+)?(?:coś|cos|jakąś|jakas|muzyk|piosen|utw|track|song|jakieś|jakies|losow)/i,
          /(?:pu[sśćcz]{1,3}|posc|graj|w[lł][aą][cć]z|wlacz|odpal|zapodaj|daj)\s*$/i,
        ];
        const hasGenericPlay = genericPlayPatterns.some(p => p.test(lowerMessage));
        
        if (hasPlayIntent && hasContextKeyword) {
          requestedCount = hasDJIntent ? 20 : 5;
        } else if (hasGenericPlay) {
          requestedCount = 5;
        }
      }

      // Detect favorites/recent/listened requests even without explicit play verb
      if (requestedCount === 0) {
        const favRecentNumMatch = lowerMessage.match(/(?:ostatni[echm]?|najnowsz[eych]|śwież[eych]|swiez[eych]|ulubionych|polubion|lubi[ęe]|słucha[łlm]|sluchal)/i) && lowerMessage.match(/(\d+)/);
        const numOnly = lowerMessage.match(/(\d+)/);
        if (numOnly && /(?:ostatni|najnowsz|ulubionych|polubion|lubi[ęe]|słucha[łlm]|sluchal|śwież|swiez|piosen|utw|track|song)/i.test(lowerMessage)) {
          requestedCount = Math.min(parseInt(numOnly[1]), 20);
        }
        // Polish word numbers + favorites/recent keywords
        if (requestedCount === 0 && (/ulubionych|polubion|lubi[ęe]|słucha[łlm]|sluchal|ostatni[echm]?\s+(?:wgrany|wrzucon|dodany|piosen|utw|słuchan)|najnowsz|z\s+serwer|ostatnie\s+\d|śwież|swiez/i.test(lowerMessage))) {
          const polishNums: Record<string, number> = {"jeden":1,"dwa":2,"trzy":3,"cztery":4,"pięć":5,"sześć":6,"siedem":7,"osiem":8,"dziewięć":9,"dziesięć":10,"piętnaście":15,"dwadzieścia":20};
          for (const [word, num] of Object.entries(polishNums)) {
            if (lowerMessage.includes(word)) { requestedCount = num; break; }
          }
          if (requestedCount === 0) requestedCount = 5;
        }
      }

      if (hasDJIntent && requestedCount === 0) requestedCount = 15;
      if (hasDJIntent && requestedCount < 10) requestedCount = Math.max(requestedCount, 10);

      if (requestedCount > 0 && playableTracks.length > 0) {
        // Detect source: favorites, recently listened, recent uploads, or general library
        const wantsFavorites = /ulubionych|polubion|liked|favorite|ulubione|z\s+ulubionych|z\s+polubionych|lubi[ęe]|lubisz/i.test(lowerMessage);
        const wantsListened = /słucha[łlm]|sluchal|ostatnio\s+(?:słucha|sluch)|niedawno|grał[oe]?m|gral[oe]?m|recently\s+(?:played|listened)/i.test(lowerMessage);
        const wantsRecent = /ostatni[echm]?\s+(?:wgrany|wrzucon|dodany|upload|piosen|utw)|najnowsz|ostatnio\s+(?:wgrany|dodany|wrzucon)|z\s+serwera|newest|recent|śwież|swiez|ostatnie\s+\d/i.test(lowerMessage);

        let candidates: any[];

        if (wantsFavorites && userFavorites.length > 0) {
          candidates = [...userFavorites];
        } else if (wantsListened && userListeningHistory.length > 0) {
          candidates = [...userListeningHistory];
        } else if (wantsRecent && recentUploads.length > 0) {
          candidates = [...recentUploads];
        } else {
          let matchingGenres: string[] = [];
          for (const [keyword, genres] of Object.entries(contextKeywords)) {
            if (lowerMessage.includes(keyword)) matchingGenres.push(...genres);
          }

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
          } else if (userPreferences && userPreferences.genre_weights) {
            // USE AI LEARNING: pick genres based on time-of-day preferences and weights
            const hour = new Date().getHours();
            let timeSlot = "morning";
            if (hour >= 12 && hour < 18) timeSlot = "afternoon";
            else if (hour >= 18) timeSlot = "evening";
            else if (hour < 6) timeSlot = "night";

            const timeGenres: string[] = userPreferences.daily_patterns?.[timeSlot] || [];
            const topWeightedGenres = Object.entries(userPreferences.genre_weights as Record<string, number>)
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 5)
              .map(([g]: any) => g);
            const preferredGenres = [...new Set([...timeGenres, ...topWeightedGenres])];
            const avoidSet = new Set((userPreferences.avoid_genres || []).map((g: string) => g.toLowerCase()));

            candidates = playableTracks.filter((t: any) => {
              const tGenre = (t.genre || "").toLowerCase();
              if (avoidSet.has(tGenre)) return false;
              return preferredGenres.some(g => tGenre.includes(g.toLowerCase()));
            });

            if (candidates.length < requestedCount) {
              // Fill with non-avoided tracks
              const remaining = playableTracks.filter((t: any) => {
                const tGenre = (t.genre || "").toLowerCase();
                return !avoidSet.has(tGenre) && !candidates.some((c: any) => c.id === t.id);
              });
              candidates = [...candidates, ...[...remaining].sort(() => Math.random() - 0.5)];
            }
          } else {
            candidates = [...playableTracks].sort(() => Math.random() - 0.5);
          }
        }

        // Don't shuffle favorites/recent/listened - keep order (by date)
        autoPlayTracks = (wantsFavorites || wantsRecent || wantsListened)
          ? candidates.slice(0, requestedCount)
          : [...candidates].sort(() => Math.random() - 0.5).slice(0, requestedCount);
      }
    }

    // Search for specific tracks matching the user's query (single track link or auto-play)
    let trackLink = null;
    if (autoPlayTracks.length === 0 && !hasRadioIntent && !hasGenerateIntent && !hasMoveIntent) {
      // Remove common command words to isolate the track/artist query
      const commandWords = new Set([
        "puść","pusc","graj","włącz","wlacz","zagraj","odtwórz","odtworz","odpal",
        "daj","dawaj","zapodaj","postaw","leć","lec","wrzuć","wrzuc","kręć","krec",
        "play","start","listen","put","give","speel","draai","zet","geef",
        "грай","увімкни","постав","давай",
        "mi","mnie","jakieś","jakies","jakiś","jakis","tam","no","to","coś","cos","please",
        "utwór","utwor","piosenkę","piosenke","piosenkę","track","song","numer","kawałek","kawalek",
        "znajdź","znajdz","poszukaj","wyszukaj","szukaj","search","find","look","zoek",
        "otwórz","otworz","pokaż","pokaz","open","show",
      ]);
      
      const queryWords = message
        .replace(/[.,!?;:"""„]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length >= 2 && !commandWords.has(w.toLowerCase()));
      
      if (queryWords.length > 0 && playableTracks.length > 0) {
        const fullQuery = queryWords.join(" ").toLowerCase();
        
        // Score-based matching for better results
        const scored = playableTracks.map((t: any) => {
          const title = (t.title || "").toLowerCase();
          const artist = (t.artist || "").toLowerCase();
          let score = 0;
          
          // Exact title/artist match
          if (title === fullQuery || artist === fullQuery) score += 100;
          // Title/artist contains full query
          if (title.includes(fullQuery) || artist.includes(fullQuery)) score += 50;
          // Individual word matches
          for (const w of queryWords) {
            const wl = w.toLowerCase();
            if (wl.length < 2) continue;
            if (title.includes(wl)) score += 10;
            if (artist.includes(wl)) score += 10;
          }
          return { track: t, score };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);
        
        if (scored.length > 0) {
          trackLink = { id: scored[0].track.id, title: scored[0].track.title, artist: scored[0].track.artist };
          
          // If user has play intent (play verbs), auto-play the found tracks
          const hasPlayVerb = /puść|pusc|graj|włącz|wlacz|zagraj|odtwórz|odtworz|odpal|zapodaj|dawaj|play|start|speel|draai|грай|увімкни/i.test(lowerMessage);
          if (hasPlayVerb && scored[0].score >= 10) {
            // Auto-play top matches (up to 5)
            autoPlayTracks = scored.slice(0, Math.min(5, scored.length)).map(s => s.track);
          }
        }
      }
    }

    // Build compact track catalog for the AI context
    const trackCatalog = playableTracks.length > 0
      ? playableTracks.map((t: any) => `${t.title} — ${t.artist} [${t.genre || '?'}/${t.mood || '?'}]`).join("\n")
      : "Brak utworów w bazie";

    // Build catalogs for favorites, recent, playlists
    const favoritesCatalog = userFavorites.length > 0
      ? userFavorites.map((t: any, i: number) => `${i+1}. ${t.title} — ${t.artist} [${t.genre || '?'}]`).join("\n")
      : "Brak ulubionych";

    const listeningHistoryCatalog = userListeningHistory.length > 0
      ? userListeningHistory.map((t: any, i: number) => `${i+1}. ${t.title} — ${t.artist} [${t.genre || '?'}] (${new Date(t.played_at).toLocaleDateString('pl')})`).join("\n")
      : "Brak historii";

    const recentUploadsCatalog = recentUploads.length > 0
      ? recentUploads.map((t: any, i: number) => `${i+1}. ${t.title} — ${t.artist} [${t.genre || '?'}] (${new Date(t.created_at).toLocaleDateString('pl')})`).join("\n")
      : "Brak";

    const playlistsCatalog = userPlaylistsData.length > 0
      ? userPlaylistsData.map((pl: any) => `📁 **${pl.title}** (${pl.tracks.length} utw.): ${pl.tracks.slice(0, 5).map((t: any) => `${t.title}`).join(", ")}${pl.tracks.length > 5 ? "..." : ""}`).join("\n")
      : "Brak playlist";

    // Build move result info
    const moveInfo = moveResult
      ? `\n\n## 📁 UTWÓR ${moveResult.action === "added" ? "DODANY DO" : "USUNIĘTY Z"} PLAYLISTY!\nUtwór **"${moveResult.trackName}"** został ${moveResult.action === "added" ? "dodany do" : "usunięty z"} playlisty **"${moveResult.playlistName}"**.\nPOTWIERDŹ operację entuzjastycznie! Użyj emoji 📁 ✅ 🎵.`
      : "";

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

    const systemPrompt = `Jesteś GrouAI — zaawansowany, inteligentny asystent AI w aplikacji muzycznej **GrouAIStream** (pełna nazwa: GrouAI Stream). Twój poziom konwersacji i wiedzy jest porównywalny z GPT-5 lub Grok. Jesteś EKSPERTEM w muzyce, kulturze, technologii, psychologii i każdym innym temacie.

## TOŻSAMOŚĆ I BRANDING:
- Twoja nazwa to **GrouAI** — jesteś asystentem platformy **GrouAIStream**
- Główna marka to **GrouaRock®** — firma stojąca za GrouAIStream
- Zawsze mów o platformie jako "GrouAIStream" lub "GrouAI Stream"
- GrouaRock® to marka-matka, GrouAIStream to produkt muzyczny AI

## DANE KONTAKTOWE (ZAWSZE PODAWAJ GDY KTOŚ PYTA O KONTAKT):
- 📧 Email: **grouarock@gmail.com**
- 📞 Telefon: **+48 570 598 552**
- Gdy ktoś pyta "jak się skontaktować?", "kontakt", "email", "telefon", "numer", "właściciel", "support", "pomoc" — ZAWSZE podaj OBA dane kontaktowe

## PEŁNA WIEDZA O PLATFORMIE GrouAIStream:
GrouAIStream to zaawansowana platforma muzyczna AI, która oferuje:

### 🎵 Odtwarzanie i odkrywanie muzyki:
- Odtwarzacz z pełną biblioteką muzyczną (setki utworów w wielu gatunkach)
- Inteligentne rekomendacje oparte na AI — uczenie się preferencji, pory dnia, dnia tygodnia
- Sekcje gatunkowe: EDM, Disco, House, Rock, Punk, Pop, Hip-Hop, R&B, Trance, Jazz, Blues, Classical, Metal, Indie, Reggae, Country, Rap
- Detekcja nastroju przez kamerę — AI rozpoznaje Twoje emocje i dobiera muzykę
- Komendy głosowe — mów do asystenta naturalnym językiem

### 🎧 AI DJ i generowanie muzyki:
- AI DJ — automatyczny DJ dobierający muzykę na żywo
- GrouAI Studio — generowanie unikalnych 30-sekundowych utworów w 15+ gatunkach
- Miksowanie audio — crossfade, overlay, mashup dwóch dowolnych utworów
- Blending gatunków — np. "House × Trap" z regulowanym współczynnikiem

### 📻 Radio na żywo (GrouaRadio):
- Radio z ramówką zarządzaną przez AI i administratora
- Czat na żywo, lajki, głosowanie słuchaczy
- Życzenia i dedykacje muzyczne na antenie
- Dynamiczna zmiana ramówki komendami głosowymi

### 🎉 Party Mode (QR Parkiet):
- Kod QR dla gości na imprezie
- Głosowanie na kolejne utwory
- Kamera na tłum z detekcją emocji
- Reakcje gości w czasie rzeczywistym

### 💰 MONETYZACJA — JAK ZARABIAĆ NA GrouAIStream:
Platforma umożliwia twórcom zarabianie na swojej muzyce:

**Stawki i podział przychodów:**
- **Streamy (royalties):** 0.003 PLN za stream (>30 sekund) — **65% dla twórcy**, 35% platforma
- **Tipy od słuchaczy:** kwoty 5/10/20/50 PLN — **90% dla twórcy**, 10% platforma
- **Pakiety Boost:**
  - Basic (9.99 PLN / 500 wyświetleń)
  - Pro (24.99 PLN / 2000 wyświetleń)
  - Viral (49.99 PLN / 5000 wyświetleń)
  - **70% dla twórcy**, 30% platforma

**Subskrypcje Creator:**
- **Creator Pro** — 19 PLN/miesiąc (priorytetowe wyświetlanie, szczegółowe statystyki, wsparcie priorytetowe)
- **Creator Ultimate** — 39 PLN/miesiąc (VIP support, ekskluzywne promocje, dostęp do beta funkcji, odznaka ⚡)

**Jak zacząć zarabiać:**
1. Wgraj utwór na /upload
2. Zaznacz checkbox "Chcę zarabiać na tym utworze"
3. Jeśli utwór z Suno — potwierdź że masz plan Pro/Premier
4. Śledź zarobki na dashboardzie /earnings
5. Wypłata od 50 PLN na konto bankowe

**🎁 PROGRAM POLECEŃ (polecaj i zarabiaj — nie musisz być twórcą!):**
- Każdy użytkownik ma swój unikalny link polecający — widać go na /earnings (panel "Program poleceń")
- Link ma postać: https://www.grouaistream.com/?ref=TWOJKOD
- Gdy polecona osoba zarejestruje się z Twojego linku i wykupi abonament (Pro lub Ultimate), dostajesz **20% prowizji od KAŻDEJ jej płatności przez 12 miesięcy**
- Prowizje wpadają do Twoich zarobków i wypłacasz je jak resztę (od 50 PLN)
- Program jest JEDNOPOZIOMOWY i w pełni legalny: prowizja tylko za własnych poleconych, tylko od realnych płatności — to NIE jest piramida ani MLM
- Gdy ktoś pyta "jak zarabiać bez wgrywania muzyki", "program poleceń", "afiliacja", "polecanie znajomym" — opisz ten program i skieruj na /earnings

**Ważne informacje prawne:**
- Utwory z Suno Pro/Premier MOŻNA monetyzować i dystrybuować
- Platforma NIE jest dystrybutorem do Spotify/Apple Music — do tego służą DistroKid, TuneCore, CD Baby
- Wrzucając utwór potwierdzasz posiadanie praw komercyjnych

### 📚 Inne funkcje:
- Import z YouTube i Spotify
- Biblioteka osobista z 15 katalogami gatunkowymi
- Playlisty AI i ręczne, drag & drop
- Historia nastroju z wykresami i raport PDF od AI-psychologa
- Asystent rozmawia w 4 językach: PL, EN, NL, UA
- Sekcja filmowa (/movies)
- Serwer mediów (/server)
- Panel admina (/admin)
- Wsparcie twórców: Buy Me a Coffee, Patronite, Ko-fi

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

## SUPER WAŻNA FUNKCJA - GENEROWANIE MUZYKI (GrouAI Studio) - TWOJA GŁÓWNA SUPERMOC:
Jesteś pełnoprawnym producentem muzycznym AI! Gdy użytkownik opisze JAKĄKOLWIEK wizję muzyczną — system AUTOMATYCZNIE analizuje prompt przez AI, wyciąga parametry (gatunek, mood, energię, tempo, blending gatunków) i uruchamia generator GrouAI Studio. 

Rozumiesz ZŁOŻONE prompty jak:
- "Zrób mi coś w stylu Daft Punk × The Weeknd, mroczne, energetyczne, 128 BPM"
- "Stwórz melancholijny beat lo-fi z elementami jazzu, spokojny"  
- "Wyprodukuj agresywny drop jak w hardstyle, 150 BPM, ciemny klimat"
- "Chcę romantyczną piosenkę, jasną, powolną, indie × pop"
- "Zrób DJ set intro, house z trapem, euforyczny, high energy"

Ty musisz POTWIERDZIĆ generowanie, SZCZEGÓŁOWO opisać co stworzyłeś (BPM, gatunek, nastrój, charakter), i powiedzieć że utwór jest gotowy. Zachowuj się jak profesjonalny producent muzyczny, komentuj decyzje produkcyjne. Użyj emoji 🎵 ✨ 🎹 🎧 🔊. Powiedz też że użytkownik może go przedłużyć o kolejne 30s.

Jeśli użytkownik poda tekst/lyrics — potwierdź że wkomponowałeś klimat tekstu w muzykę (emocje tekstu wpływają na mood i energię).
${generateResult ? `\n### AKTYWNA GENERACJA:\nWłaśnie uruchamiam generator GrouAI Studio:\n- **Styl:** ${generateResult.style}${generateResult.style2 ? ` × ${generateResult.style2}` : ""}\n- **Nastrój:** ${generateResult.mood || "auto"}\n- **Energia:** ${generateResult.energy || "medium"}\n- **BPM:** ${generateResult.tempoOverride || "auto"}\n${generateResult.instrumental ? "- **Instrumental** (bez wokalu)" : ""}\n${generateResult.title ? `- **Tytuł:** "${generateResult.title}"` : ""}\n- **Prompt:** "${generateResult.prompt}"\n\nPotwierdź to entuzjastycznie jak profesjonalny producent! Opisz szczegóły techniczne produkcji.` : ""}

## SUPER WAŻNA FUNKCJA - MIKSOWANIE AUDIO:
Gdy użytkownik załącza 2 pliki audio i pisze "miksuj", "zmixuj", "połącz", "mashup" itp. — system AUTOMATYCZNIE miksuje oba pliki w jeden za pomocą Web Audio API. Dostępne style: crossfade (domyślny), overlay, mashup.
${mixRequest ? `\n### AKTYWNE MIKSOWANIE:\nWłaśnie miksuję 2 pliki audio użytkownika w stylu **${mixRequest.style}**!\n- Plik 1: ${audioAttachments[0]?.name || "Track A"}\n- Plik 2: ${audioAttachments[1]?.name || "Track B"}\n\nPotwierdź miksowanie entuzjastycznie! Opisz styl mixu (${mixRequest.style}). Użyj emoji 🎧 🔀 🎶 ✨.` : ""}
${audioAttachments.length > 0 && !mixRequest ? `\n### ZAŁĄCZONE PLIKI AUDIO:\nUżytkownik załączył ${audioAttachments.length} plik(ów) audio: ${audioAttachments.map((a: any) => a.name).join(", ")}. Możesz zaproponować ich zmiksowanie, jeśli jest 2+, lub skomentować.` : ""}

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

## PEŁNA BIBLIOTEKA MUZYCZNA (ZNASZ WSZYSTKIE TE UTWORY — ${playableTracks.length} szt.):
${trackCatalog}

## ULUBIONE UTWORY UŻYTKOWNIKA (${userFavorites.length} szt.):
${favoritesCatalog}

## OSTATNIO SŁUCHANE UTWORY (HISTORIA ODTWARZANIA — ${userListeningHistory.length} szt.):
${listeningHistoryCatalog}

## OSTATNIE 20 WGRANYCH UTWORÓW (NAJNOWSZE W SERWISIE):
${recentUploadsCatalog}

## PLAYLISTY/KATALOGI UŻYTKOWNIKA (${userPlaylistsData.length} szt.):
${playlistsCatalog}
${moveInfo}

## SUPER WAŻNA FUNKCJA - ULUBIONE, OSTATNIO SŁUCHANE I WGRANE:
Gdy użytkownik mówi "daj 5 z ulubionych", "puść ostatnie polubione", "ostatnie wgrane 10", "piosenki które lubię", "co ostatnio słuchałem", "10 piosenek które lubię" — system AUTOMATYCZNIE wybiera odpowiednie utwory z ulubionych, historii słuchania lub najnowszych wgranych i włącza na playerze. Znasz DOKŁADNE daty wgrania, polubienia i odtworzenia. Ty musisz POTWIERDZIĆ co włączasz, wymienić utwory z numeracją.

## SUPER WAŻNA FUNKCJA - ZARZĄDZANIE UTWORAMI MIĘDZY KATALOGAMI:
Gdy użytkownik mówi "przenieś X do katalogu Y", "wytnij X z playlisty", "dodaj X do playlisty Y", "usuń X z katalogu" — system AUTOMATYCZNIE wykonuje operację. Znasz WSZYSTKIE playlisty użytkownika i ich zawartość. Potwierdź operację.

## SUPER WAŻNA FUNKCJA - UCZENIE SIĘ PREFERENCJI (AI LEARNING ENGINE):
System posiada zaawansowany silnik uczenia się preferencji użytkownika. Analizuje CODZIENNIE wzorce słuchania — gatunki, nastroje, pory dnia, dni tygodnia, częstotliwość skipów.

${userPreferences ? `### 🧠 PROFIL AI UŻYTKOWNIKA (automatycznie wygenerowany):
- **Preferowane gatunki (wagi):** ${JSON.stringify(userPreferences.genre_weights || {})}
- **Preferowane nastroje (wagi):** ${JSON.stringify(userPreferences.mood_weights || {})}
- **Wzorce dzienne:**
  - Rano: ${(userPreferences.daily_patterns?.morning || []).join(", ") || "brak danych"}
  - Popołudnie: ${(userPreferences.daily_patterns?.afternoon || []).join(", ") || "brak danych"}
  - Wieczór: ${(userPreferences.daily_patterns?.evening || []).join(", ") || "brak danych"}
  - Noc: ${(userPreferences.daily_patterns?.night || []).join(", ") || "brak danych"}
- **Wzorce tygodniowe:** ${JSON.stringify(userPreferences.weekly_patterns || {})}
- **Preferowana energia:** ${userPreferences.preferred_energy || "medium"}
- **Preferowane tempo:** ${userPreferences.preferred_tempo || "medium"}
- **Unikane gatunki (wysokie skip-rate):** ${(userPreferences.avoid_genres || []).join(", ") || "brak"}
- **Unikane nastroje:** ${(userPreferences.avoid_moods || []).join(", ") || "brak"}
- **Łącznie przeanalizowanych utworów:** ${userPreferences.total_tracks_analyzed || 0}
- **Profil psychologiczny AI:** ${userPreferences.ai_profile_summary || "jeszcze nie wygenerowany"}

UŻYJ TYCH DANYCH aby:
1. Proponować muzykę dopasowaną do PORY DNIA (rano → gatunki poranne, wieczorem → wieczorne)
2. Unikać gatunków z wysokim skip-rate
3. Preferować gatunki z najwyższymi wagami
4. Dostosowywać energię i tempo do preferencji użytkownika
5. Na weekendy proponować gatunki weekendowe, w tygodniu → robocze
6. Gdy użytkownik mówi "puść coś" bez kontekstu → AUTOMATYCZNIE dobieraj na podstawie pory dnia + dnia tygodnia + preferencji` : "Profil AI jeszcze nie został wygenerowany — zbyt mało danych odsłuchowych."}

Analizujesz historię słuchania, ulubione gatunki (${topGenres.join(", ") || "nieznane"}) i nastroje (${topMoods.join(", ") || "nieznane"}) użytkownika. Na tej podstawie proponujesz coraz trafniejsze rekomendacje. Jeśli użytkownik często słucha jednego gatunku — domyślnie preferuj ten gatunek. Pamiętaj kontekst rozmowy i ucz się z każdej interakcji.

## NAWIGACJA PO APLIKACJI GrouAIStream:
Znasz DOKŁADNIE każdą funkcję i stronę:
- **Strona główna (/)**: Sekcje gatunkowe (EDM, Disco, House, Rock, Punk, Pop, Hip-Hop, R&B, Trance), Radio na żywo, AI DJ, Playlisty
- **Wyszukiwarka (/search)**: Wyszukiwanie utworów po tytule, artyście, gatunku
- **Biblioteka (/library)**: Osobista kolekcja użytkownika — 15 katalogów gatunkowych
- **Polubione (/liked)**: Lista ulubionych utworów (${userFavorites.length} szt.)
- **Tworzenie playlist (/create-playlist)**: Tworzenie playlist AI lub ręcznych
- **Menedżer playlist (/playlist-manager)**: Zarządzanie, edycja, usuwanie playlist — drag & drop
- **Radio (/radio-live)**: Radio na żywo GrouaRadio — MOŻESZ ZMIENIAĆ RAMÓWKĘ!
- **Upload (/upload)**: Wgrywanie utworów z opcją monetyzacji
- **Zarabiaj z nami (/earn)**: Informacje o zarabianiu, plany Creator Pro/Ultimate
- **Moje zarobki (/earnings)**: Dashboard twórcy z przychodami, wypłatami, statystykami
- **Import YouTube (/import-youtube)**: Importowanie muzyki z YouTube
- **Filmy (/movies)**: Sekcja filmowa
- **Serwer mediów (/server)**: Zarządzanie plikami — ostatnie wgrane utwory
- **Historia nastroju (/mood-history)**: Wykresy nastrojów + raport PDF AI-psychologa
- **Ustawienia (/settings)**: Konfiguracja konta, język (PL/EN/NL/UA), motyw
- **Panel admina (/admin)**: Zarządzanie dla administratorów
- **Detekcja nastroju**: Rozpoznawanie emocji przez kamerę
- **Komendy głosowe**: Asystent głosowy naturalnym językiem
- **Drag & Drop**: Przeciąganie utworów między playlistami
- **AI DJ**: Automatyczny DJ dobierający muzykę na podstawie nastroju
- **QR Parkiet (/party/:code)**: System głosowania i reakcji gości na parkiecie DJ

## SPECJALNE KONTEKSTY:
- Pytania o vinyl/winyl → kieruj do sekcji **Hubs Vinyl** w aplikacji
- Współpraca/biznes/kontakt → email: **grouarock@gmail.com**, tel: **+48 570 598 552**
- Pytania o zarabianie → kieruj na /earn i /earnings, opisz stawki i pakiety
- Pytania o upload → kieruj na /upload, wspomnij o opcji monetyzacji
- Pytania o Suno → wyjaśnij że utwory z Suno Pro/Premier można monetyzować
- Pytania o Spotify/Apple Music → wyjaśnij że do dystrybucji służą DistroKid, TuneCore, CD Baby (GrouAIStream nie jest dystrybutorem)
- Gdy użytkownik pyta o konkretny utwór z biblioteki — podaj szczegóły i zaproponuj odtworzenie
- Gdy pyta "co masz?", "jakie utwory?", "co mogę posłuchać?" — pokaż przegląd gatunków, ulubionych i ostatnich wgranych
- Gdy pyta o playlisty/katalogi — wymień wszystkie playlisty użytkownika z zawartością
- Gdy mówi "ostatnie z serwera" — pokaż ostatnie wgrane utwory z datami

## ZASADY:
1. ZAWSZE odpowiadaj w języku **${userLanguageName}** — to jest BEZWZGLĘDNA zasada
2. Bądź pomocny, dokładny i wyczerpujący
3. Nie bój się długich odpowiedzi gdy temat tego wymaga
4. Przy pytaniach muzycznych — podawaj ciekawostki, kontekst historyczny, porównania
5. Przy pytaniach technicznych — wyjaśniaj krok po kroku
6. Przy emocjach użytkownika — bądź empatyczny i wspierający
7. Możesz prowadzić naturalną konwersację na DOWOLNY temat
8. ZAWSZE znaj zawartość biblioteki muzycznej — jeśli użytkownik pyta o utwór, sprawdź czy jest w katalogu powyżej
9. Znasz DOKŁADNIE ulubione utwory, ostatnie wgrane, playlisty i katalogi — odpowiadaj precyzyjnie z datami
10. UCZ SIĘ z każdej rozmowy — zapamiętuj preferencje i dopasowuj rekomendacje
11. Gdy masz dane z wyszukiwania internetowego (WEB SEARCH) — WYKORZYSTAJ JE w odpowiedzi. Cytuj źródła, podawaj fakty
12. ZAWSZE podawaj dane kontaktowe (grouarock@gmail.com, +48 570 598 552) gdy ktoś pyta o kontakt, wsparcie, pomoc, właściciela
13. Mów o platformie jako **GrouAIStream**, o marce jako **GrouaRock®**`;


    // ==========================================
    // WEB SEARCH via Grok (xAI) — for factual/general questions
    // ==========================================
    let webSearchResult = "";

    // Detect if user is asking a factual/web question (not music playback commands)
    const isPlaybackCommand = /(?:puść|pusc|graj|zagraj|włącz|wlacz|odtwórz|odtworz|play|next|prev|pause|stop|volume|głośn|glosn|skip|następn|nastepn|poprzedni|dodaj do|usuń z|przenieś|przenies|dedykuj|miksuj|zmixuj|wygeneruj|stwórz|stworz|zmień.*radio|ustaw.*radio)/i.test(lowerMessage);
    const isWebQuestion = !isPlaybackCommand && !hasRadioIntent && !hasWishIntent && !hasDedicationIntent && !hasRadioAddIntent && !hasRadioRemoveIntent && !hasGenerateIntent && (
      // Explicit search intents
      /(?:wyszukaj|szukaj|znajdź|znajdz|sprawdź|sprawdz|search|find|look up|google|check|co to|kto to|ile|kiedy|gdzie|dlaczego|jak|why|what|who|when|where|how|pogoda|weather|news|wiadomości|wiadomosci|cena|price|kurs|wynik|score|rezultat|result|najnowsz|latest|aktualn|current)/i.test(lowerMessage) ||
      // Questions about real-world facts
      /(?:czy\s+.{5,}\?|what\s+is|who\s+is|how\s+to|tell\s+me\s+about|opowiedz\s+o|powiedz\s+mi\s+o)/i.test(lowerMessage) ||
      // Any question mark with sufficient length (likely a factual question)
      (lowerMessage.includes("?") && lowerMessage.length > 15 && !/(?:puść|graj|play|włącz|daj mi|zapodaj)/i.test(lowerMessage))
    );

    if (isWebQuestion && GROK_API_KEY) {
      try {
        console.log("🔍 Web search triggered for:", message.slice(0, 100));
        const grokResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROK_API_KEY}`, "HTTP-Referer": "https://grouaistream.com", "X-Title": "Groua AI Stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "x-ai/grok-3-mini",
            messages: [
              {
                role: "system",
                content: "You are a real-time search and knowledge assistant. Answer the user's question with factual, up-to-date information. Be concise but comprehensive. Include relevant data, dates, numbers, sources when possible. Answer in the same language as the question. For weather questions: ALWAYS provide current temperature, conditions, humidity, wind speed for ANY city, region or country in the world — no matter how obscure. Include today's and tomorrow's forecast. Use metric units (Celsius, km/h). For country-level weather questions, provide weather for the capital city."
              },
              { role: "user", content: message }
            ],
            search_mode: "auto",
          }),
        });

        if (grokResponse.ok) {
          const grokData = await grokResponse.json();
          const grokAnswer = grokData.choices?.[0]?.message?.content;
          if (grokAnswer) {
            webSearchResult = `\n\n## 🌐 DANE Z WYSZUKIWANIA INTERNETOWEGO (GROK AI):\n${grokAnswer}\n\nUŻYJ TYCH DANYCH w swojej odpowiedzi! Sformatuj je ładnie z emoji i markdown. Jeśli pytanie dotyczyło faktów — odpowiedz na podstawie tych danych. Dodaj że sprawdziłeś to w sieci. Użyj emoji 🌐 🔍.`;
            console.log("✅ Web search result received, length:", grokAnswer.length);
          }
        } else {
          console.error("Grok API error:", grokResponse.status, await grokResponse.text());
        }
      } catch (e) {
        console.error("Web search error:", e);
      }
    }

    const userPrompt = message;

    // Lovable AI first: stream through the Lovable AI gateway
    let aiResponseText = "";
    let aiResponse: Response | null = null;

    if (LOVABLE_API_KEY) {
      try {
        const res = await fetch(LOVABLE_AI_CHAT_URL, {
          method: "POST",
          headers: lovableAiHeaders(LOVABLE_API_KEY),
          body: JSON.stringify({
            model: LOVABLE_AI_MODEL,
            messages: [
              { role: "system", content: systemPrompt + webSearchResult },
              ...history.slice(-12).map((m: any) => ({ role: m.role, content: m.content || "" })),
              { role: "user", content: userPrompt },
            ],
            max_tokens: 4096,
            temperature: 0.8,
            stream: true,
          }),
        });

        if (res.ok) {
          aiResponse = res;
          console.log("Lovable AI model used:", LOVABLE_AI_MODEL);
        } else {
          const errBody = await res.text();
          console.error("Lovable AI gateway error:", res.status, errBody.substring(0, 500));
          if (res.status === 402) aiResponseText = "AI jest podłączone przez Lovable, ale skończyły się kredyty. Doładuj kredyty w ustawieniach workspace i spróbuj ponownie.";
          if (res.status === 429) aiResponseText = "AI jest chwilowo przeciążone limitem zapytań. Spróbuj ponownie za moment.";
        }
      } catch (e) {
        console.error("Lovable AI gateway exception:", e);
      }
    }

    if (!aiResponse && !aiResponseText && GEMINI_API_KEY) {
      // Try multiple Gemini models — different keys support different models
      const geminiModels = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-8b",
        "gemini-pro",
      ];
      let historyForGemini = history.slice(-12).filter((m: any) => m.content?.trim());
      while (historyForGemini.length > 0 && historyForGemini[0].role === "assistant") {
        historyForGemini = historyForGemini.slice(1);
      }
      const geminiMessages = [
        ...historyForGemini.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content || "" }],
        })),
        { role: "user", parts: [{ text: userPrompt }] },
      ];

      for (const gModel of geminiModels) {
        if (aiResponseText) break;
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: geminiMessages,
                systemInstruction: { parts: [{ text: systemPrompt + webSearchResult }] },
                generationConfig: { maxOutputTokens: 4096, temperature: 0.8 },
              }),
            }
          );
          if (geminiRes.ok) {
            const gd = await geminiRes.json();
            aiResponseText = gd.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            if (aiResponseText) {
              console.log("Gemini model used:", gModel);
            } else {
              console.error("Gemini empty response from", gModel, JSON.stringify(gd).substring(0, 200));
            }
          } else {
            const errBody = await geminiRes.text();
            console.error(`Gemini ${gModel} error:`, geminiRes.status, errBody.substring(0, 150));
          }
        } catch (e) {
          console.error(`Gemini ${gModel} exception:`, e);
        }
      }
    }

    if (!aiResponseText) {
    // Build a shorter system prompt for free models (limited context window)
    const shortTrackList = playableTracks.slice(0, 80).map((t: any) => `${t.title} — ${t.artist} [${t.genre || '?'}]`).join("\n");
    const shortSystemPrompt = `Jesteś GrouAI — asystent AI platformy muzycznej GrouAIStream (grouaistream.com). Jesteś pomocny, przyjazny i ekspertem w muzyce.
Kontakt: grouarock@gmail.com, tel: +48 570 598 552.
Użytkownik: ${userName || "Gość"}. Odpowiadaj zawsze po polsku (lub w języku pytania).
Biblioteka muzyczna (${playableTracks.length} szt., fragment):
${shortTrackList}${playableTracks.length > 80 ? `\n... i ${playableTracks.length - 80} więcej` : ""}
Ulubione: ${userFavorites.slice(0, 20).map((t: any) => t.title).join(", ") || "brak"}`;

    // Try multiple OpenRouter models in order until one succeeds
    const openRouterModels = [
      "openai/gpt-4o-mini",
      "anthropic/claude-3-haiku",
      "mistralai/mistral-small",
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.1-8b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
      "qwen/qwen-2-7b-instruct:free",
      "google/gemma-2-9b-it:free",
    ];

    let aiResponse: Response | null = null;
    for (const model of openRouterModels) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROK_API_KEY}`,
            "HTTP-Referer": "https://grouaistream.com",
            "X-Title": "Groua AI Stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: shortSystemPrompt },
              ...history.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
              { role: "user", content: userPrompt }
            ],
            stream: true,
          }),
        });
        if (res.ok) {
          aiResponse = res;
          console.log("OpenRouter model used:", model);
          break;
        }
        console.warn(`Model ${model} failed with status ${res.status}, trying next...`);
      } catch (e) {
        console.warn(`Model ${model} threw error:`, e);
      }
    }

    // If all OpenRouter models failed — try Gemini via OpenRouter as last resort
    if (!aiResponse && GROK_API_KEY) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROK_API_KEY}`,
            "HTTP-Referer": "https://grouaistream.com",
            "X-Title": "Groua AI Stream",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
              { role: "system", content: shortSystemPrompt },
              ...history.slice(-6).map((m: any) => ({ role: m.role, content: m.content })),
              { role: "user", content: userPrompt }
            ],
            stream: true,
          }),
        });
        if (res.ok) {
          aiResponse = res;
          console.log("Gemini via OpenRouter fallback worked");
        } else {
          console.error("Gemini via OpenRouter failed:", res.status, await res.text());
        }
      } catch (e) {
        console.error("Gemini via OpenRouter exception:", e);
      }
    }

    if (!aiResponse) {
      aiResponseText = "Hej! Chwilowo mam problemy z połączeniem z serwerami AI. Spróbuj ponownie za chwilę! 🔄";
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
        // Send music generation event
        if (generateResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "music_generate",
            data: generateResult,
          })}\n\n`));
        }
        // Send audio mix event
        if (mixRequest) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "audio_mix",
            data: mixRequest,
          })}\n\n`));
        }
        // Send playlist move event
        if (moveResult) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "playlist_track_moved",
            data: moveResult,
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

        if (aiResponse) {
          const reader = aiResponse.body!.getReader();
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
        } else {
          // All models failed — stream the fallback text
          const fallbackWords = aiResponseText.split(" ");
          for (const word of fallbackWords) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: word + " " } }] })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    });

    return new Response(body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
    } // end if (!aiResponseText)

    // Gemini path — emit as SSE
    const encoder2 = new TextEncoder();
    const geminiBody = new ReadableStream({
      start(controller) {
        if (radioUpdateResult) controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ type: "radio_updated", data: radioUpdateResult })}\n\n`));
        if (wishResult) controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ type: "radio_wish_sent", data: wishResult })}\n\n`));
        if (autoPlayTracks.length > 0) controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ type: "auto_play_tracks", data: autoPlayTracks.map((t: any) => ({ id: t.id, title: t.title, artist: t.artist, genre: t.genre })) })}\n\n`));
        // Emit text as SSE delta chunks (compatible with OpenRouter format)
        const words = aiResponseText.split(" ");
        for (const word of words) {
          controller.enqueue(encoder2.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: word + " " } }] })}\n\n`));
        }
        controller.enqueue(encoder2.encode("data: [DONE]\n\n"));
        controller.close();
      }
    });
    return new Response(geminiBody, {
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
