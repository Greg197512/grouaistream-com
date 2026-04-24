import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailType =
  | "invitation" | "challenge" | "newsletter" | "weekly_digest" | "easter"
  | "feature_announcement" | "tip_of_the_week" | "blog_post" | "milestone"
  | "comeback" | "thank_you" | "ai_studio_promo" | "live_radio_promo"
  | "party_mode_promo" | "custom";

interface EmailRequest {
  type: EmailType;
  recipientName?: string;
  customMessage?: string;
  generateImage?: boolean; // domyślnie true
  stats?: {
    totalTracks: number;
    totalUsers: number;
    topGenres: string[];
  };
}

// === Premium hero image — ten sam wzorzec co w mass-email-dispatch ===
function buildImagePrompt(emailType: EmailType, copyHeadline?: string): string {
  const baseStyle = "ultra-cinematic editorial style, deep black background with soft aurora borealis, vibrant orange neon (#e8450a) and warm amber (#f59e0b) accents, glowing bass particles, premium music platform aesthetic, dramatic light rays, depth of field, 16:9, no text, no logos, no watermarks";
  const themes: Record<EmailType, string> = {
    invitation: "elegant glowing music portal opening into a dark velvet space with floating sound waves",
    challenge: "iconic glowing trophy on a dark stage surrounded by orange spotlights and bass particles",
    newsletter: "dark editorial magazine cover, glowing headphones suspended in aurora light",
    weekly_digest: "cozy dark studio at night, vinyl records glowing under warm amber lamp, week timeline",
    easter: "elegant decorated easter eggs with neon orange music notes on luxurious black silk",
    feature_announcement: "futuristic neon music interface floating in dark space, glowing buttons revealing new feature",
    tip_of_the_week: "close-up of glowing lightbulb made of music notes, dark moody background",
    blog_post: "elegant open book transforming into musical waves, dark editorial style",
    milestone: "fireworks of orange neon light over dark city skyline, celebratory cinematic mood",
    comeback: "lonely glowing microphone in dim spotlight, warm nostalgic atmosphere",
    thank_you: "warm orange heart made of glowing sound waves on deep black background",
    ai_studio_promo: "futuristic AI music workstation with floating waveforms and neon controls",
    live_radio_promo: "glowing on-air sign in dark radio studio, vintage microphone with neon halo",
    party_mode_promo: "crowded silhouettes dancing under orange laser lights, energetic club atmosphere",
    custom: "abstract orange aurora flowing through dark cosmic space with bass particles",
  };
  const theme = themes[emailType] || themes.custom;
  const headlineHint = copyHeadline ? ` Inspired by: "${copyHeadline}".` : "";
  return `${theme}.${headlineHint} ${baseStyle}`;
}

async function generateHeroImage(emailType: EmailType, apiKey: string, copyHeadline?: string): Promise<string | null> {
  try {
    const prompt = buildImagePrompt(emailType, copyHeadline);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("Image gen failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
  } catch (e) {
    console.error("Image gen exception:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { type, recipientName, customMessage, generateImage = true, stats }: EmailRequest = await req.json();

    const systemPrompt = `Jesteś ekspertem od komunikacji marki GrouAI Stream — premium platformy muzycznej z AI.

TOŻSAMOŚĆ MARKI:
- GrouAI Stream to „muzyka, która słucha Ciebie" — empatyczny, inteligentny DJ oparty na AI
- Funkcje kluczowe: detekcja nastroju przez kamerę, komendy głosowe, generowanie muzyki AI, radio na żywo, sesje DJ z QR, raport AI-psychologa
- Ton marki: premium, ciepły, inteligentny, z nutą poetyckości. Nigdy korporacyjny czy sztywny.
- Kolory marki: pomarańczowy (#e8450a) jako akcent, ciemne tło, neonowe detale

ZASADY PISANIA:
1. Pisz po polsku, profesjonalnie ale z duszą — jak człowiek do człowieka
2. Używaj max 3 emoji, tylko jako subtelne akcenty (🎵 🎧 ✨), nigdy w nadmiarze
3. Struktura: chwytliwy nagłówek → treść wartościowa → jasne CTA
4. Unikaj pustych frazesów i korporacyjnego żargonu
5. Max 140 słów treści — każde zdanie musi nieść wartość
6. Wplataj unikalne cechy platformy (AI mood, generowanie muzyki, sesje DJ)
7. Generuj piękny, dobrze sformatowany HTML z:
   - Nagłówkami w kolorze #e8450a (pomarańczowy GrouAI)
   - Przyciskami CTA z gradientem od #e8450a do #f59e0b
   - Czystą typografią (Inter lub Arial)
   - Separatorami i spacjami dla czytelności
   - Responsywnym layoutem (max-width 580px, padding 20-30px)
8. HTML body musi mieć białe tło (#ffffff), akcenty w kolorach marki`;

    const contextDirective = customMessage && customMessage.trim()
      ? `\n\n⚠️ KRYTYCZNE — KONTEKST OD ADMINA (MUSI być widoczny w treści maila, sparafrazowany lub dosłownie, ale jasno przekazany odbiorcy):\n"""\n${customMessage.trim()}\n"""\nTen kontekst jest najważniejszą informacją w mailu — całe pozostałe pisanie ma być wokół niego. Nie ignoruj go, nie zastępuj własną kreacją.\n`
      : "";

    let userPrompt = "";
    switch (type) {
      case "invitation":
        userPrompt = `Wygeneruj e-mail zapraszający ${recipientName ? `użytkownika ${recipientName} ` : ""}do GrouAI Stream.
Podkreśl 3 unikalne funkcje: (1) AI rozpoznaje nastrój przez kamerę i dobiera muzykę, (2) generowanie własnych utworów w 15 gatunkach, (3) radio na żywo z czatem i głosowaniem.
Zakończ mocnym CTA zachęcającym do dołączenia.${contextDirective}`;
        break;
      case "challenge":
        userPrompt = `Wygeneruj e-mail z ekskluzywnym muzycznym wyzwaniem tygodniowym dla ${recipientName ? `${recipientName}` : "użytkownika"}.
Wymyśl kreatywne, angażujące wyzwanie powiązane z funkcjami AI (np. „Pozwól AI odczytać 5 Twoich nastrojów", „Stwórz utwór AI w gatunku, którego nigdy nie słuchałeś").
Dodaj motywujący opis dlaczego warto i co użytkownik zyska.${contextDirective}`;
        break;
      case "newsletter":
        userPrompt = `Wygeneruj elegancki newsletter o nowościach w GrouAI Stream.
Struktura: (1) główna nowość/highlight, (2) ciekawostka o AI w muzyce, (3) krótka statystyka platformy.
${stats ? `Statystyki do wykorzystania: ${stats.totalTracks} utworów, ${stats.totalUsers} użytkowników, popularne gatunki: ${stats.topGenres.join(", ")}` : ""}${contextDirective}`;
        break;
      case "weekly_digest":
        userPrompt = `Wygeneruj spersonalizowane cotygodniowe podsumowanie dla ${recipientName ? `${recipientName}` : "użytkownika"}.
Struktura: (1) podziękowanie za bycie częścią społeczności, (2) odkrywcza rekomendacja — zaproponuj eksplorację nowego gatunku lub funkcji (np. sesje DJ, generowanie muzyki, mood detection), (3) inspirująca myśl o muzyce na nowy tydzień.
${stats ? `Dane platformy: ${stats.totalTracks} utworów dostępnych w ${stats.topGenres.length} gatunkach` : ""}${contextDirective}`;
        break;
      case "easter":
        userPrompt = `Wygeneruj piękny, ciepły e-mail z życzeniami wielkanocnymi od zespołu GrouAI Stream dla ${recipientName ? `${recipientName}` : "użytkownika"}.
Struktura: (1) serdeczne życzenia świąteczne — nawiąż do muzyki, harmonii i wspólnego słuchania jako metafory świąt, (2) krótkie podziękowanie za bycie częścią społeczności GrouAI Stream, (3) życzenie spokoju, radości i pięknych dźwięków na Wielkanoc.
Ton: ciepły, poetycki, premium — jak kartka od bliskiego przyjaciela, nie od korporacji. Użyj subtelnych motywów wielkanocnych (wiosna, odrodzenie, światło, nadzieja) wplecionych w kontekst muzyczny.
Dodaj emoji wielkanocne jako delikatne akcenty (🐣 🌷 ✨), max 3.${contextDirective}`;
        break;
      case "feature_announcement":
        userPrompt = `Wygeneruj e-mail ogłaszający nową funkcję w GrouAI Stream${recipientName ? ` dla ${recipientName}` : ""}.
Struktura: (1) intrygujący nagłówek o nowości, (2) co to robi i dlaczego zmienia sposób słuchania, (3) jak tego użyć w 1 zdaniu, (4) CTA „Wypróbuj teraz".${contextDirective}`;
        break;
      case "tip_of_the_week":
        userPrompt = `Wygeneruj e-mail „Trik tygodnia" dla ${recipientName ? recipientName : "użytkownika"} GrouAI Stream.
Struktura: (1) jeden konkretny, mało znany trik (np. „komenda głosowa do szybkiego mashupu", „ukryty skrót w AI Studio"), (2) krok po kroku jak go użyć (3-4 punkty), (3) co dzięki temu zyska.${contextDirective}`;
        break;
      case "blog_post":
        userPrompt = `Wygeneruj e-mail anonsujący nowy wpis blogowy GrouAI Stream${recipientName ? ` dla ${recipientName}` : ""}.
Struktura: (1) chwytliwy tytuł nawiązujący do tematu wpisu, (2) 2-3 zdania o czym jest i co czytelnik wyniesie, (3) CTA „Czytaj na blogu".${contextDirective}`;
        break;
      case "milestone":
        userPrompt = `Wygeneruj e-mail świętujący kamień milowy ${recipientName ? `użytkownika ${recipientName}` : "użytkownika"} w GrouAI Stream.
Struktura: (1) gratulacje za osiągnięcie, (2) co to mówi o jego stylu / pasji do muzyki, (3) co go czeka dalej (kolejny goal, nowa funkcja, nagroda).${contextDirective}`;
        break;
      case "comeback":
        userPrompt = `Wygeneruj ciepły e-mail „tęsknimy" do ${recipientName ? recipientName : "użytkownika"}, który dawno nie był w GrouAI Stream.
Ton: nigdy nachalny, nigdy „kup", zawsze emocjonalny. Struktura: (1) „muzyka czeka na Ciebie" — krótka poetycka myśl, (2) co nowego pojawiło się od jego ostatniej wizyty (1-2 rzeczy), (3) delikatne CTA „Wróć i posłuchaj".${contextDirective}`;
        break;
      case "thank_you":
        userPrompt = `Wygeneruj e-mail z podziękowaniem dla ${recipientName ? recipientName : "użytkownika"} GrouAI Stream.
Struktura: (1) szczere, osobiste podziękowanie (nie korpo!), (2) za co konkretnie dziękujemy, (3) co to znaczy dla zespołu i społeczności.${contextDirective}`;
        break;
      case "ai_studio_promo":
        userPrompt = `Wygeneruj e-mail promujący GrouAI Studio (generowanie muzyki AI) dla ${recipientName ? recipientName : "użytkownika"}.
Struktura: (1) „stwórz utwór, którego nikt nigdy nie napisał" — emocjonalny hook, (2) jak to działa w 3 krokach (prompt → gatunek → utwór), (3) CTA „Otwórz AI Studio".${contextDirective}`;
        break;
      case "live_radio_promo":
        userPrompt = `Wygeneruj e-mail promujący Live Radio GrouAI Stream dla ${recipientName ? recipientName : "użytkownika"}.
Struktura: (1) „tysiące serc słyszą to samo w tej samej chwili" — emocjonalny hook o wspólnym słuchaniu, (2) co dzieje się na żywo (czat, lajki, głosowanie), (3) CTA „Wejdź na Live".${contextDirective}`;
        break;
      case "party_mode_promo":
        userPrompt = `Wygeneruj e-mail promujący Party Mode / Sesje DJ z QR dla ${recipientName ? recipientName : "użytkownika"}.
Struktura: (1) „Twoja impreza, Twoje DJ" — co to daje, (2) jak to działa (QR dla gości, głosowanie, kamera tłumu, detekcja emocji), (3) CTA „Uruchom sesję DJ".${contextDirective}`;
        break;
      case "custom":
      default:
        userPrompt = customMessage && customMessage.trim()
          ? `Wygeneruj piękny, premium e-mail GrouAI Stream${recipientName ? ` skierowany do ${recipientName}` : ""} oparty W CAŁOŚCI na poniższej wiadomości od redakcji. Zachowaj jej sens i ton, dodaj jedynie spójną oprawę graficzną (HTML), chwytliwy nagłówek wynikający z treści i jasne CTA „Otwórz GrouAI Stream" prowadzące na https://grouaistream.com.

WIADOMOŚĆ OD REDAKCJI (to jest TREŚĆ maila — nie zastępuj jej własną kreacją):
"""
${customMessage.trim()}
"""`
          : `Wygeneruj krótki, ciepły e-mail powitalny od GrouAI Stream${recipientName ? ` dla ${recipientName}` : ""} z zaproszeniem do odkrycia platformy.`;
        break;
    }

    // === Równolegle: tekst maila + hero image ===
    const textPromise = fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_email",
              description: "Generate email content with subject and body",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email HTML body content" },
                  preview: { type: "string", description: "Email preview text (50 chars max)" }
                },
                required: ["subject", "body", "preview"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_email" } }
      }),
    });

    const imagePromise: Promise<string | null> = generateImage
      ? generateHeroImage(type, LOVABLE_API_KEY, customMessage || undefined)
      : Promise.resolve(null);

    const [response, heroImageUrl] = await Promise.all([textPromise, imagePromise]);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Zbyt wiele zapytań. Spróbuj ponownie za chwilę." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Brak środków na konto AI. Doładuj kredyty." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No email content generated");
    }

    const emailContent = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      success: true,
      email: {
        subject: emailContent.subject,
        body: emailContent.body,
        preview: emailContent.preview,
        heroImageUrl, // może być null jeśli generacja padła — szablon ma fallback
        type,
        generatedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-email error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
