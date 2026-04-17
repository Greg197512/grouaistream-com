// Lovable AI Vision — analyze face emotion from a snapshot
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_EMOTIONS = [
  "happy",
  "sad",
  "angry",
  "surprised",
  "neutral",
  "fearful",
  "disgusted",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure data URL prefix
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in facial emotion recognition. Analyze the human face in the image and detect the dominant emotion. Always call the report_emotion tool. If no face is visible at all, set face_detected=false.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this face and report the dominant emotion." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_emotion",
              description: "Report the detected facial emotion",
              parameters: {
                type: "object",
                properties: {
                  face_detected: { type: "boolean" },
                  dominant_emotion: {
                    type: "string",
                    enum: VALID_EMOTIONS,
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence 0-100",
                  },
                  emotions: {
                    type: "object",
                    description: "Score 0-1 per emotion",
                    properties: {
                      happy: { type: "number" },
                      sad: { type: "number" },
                      angry: { type: "number" },
                      surprised: { type: "number" },
                      neutral: { type: "number" },
                      fearful: { type: "number" },
                      disgusted: { type: "number" },
                    },
                  },
                },
                required: ["face_detected", "dominant_emotion", "confidence", "emotions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_emotion" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("[ai-vision-mood] gateway error", aiRes.status, txt);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limit zapytań. Spróbuj za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Wyczerpane kredyty AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await aiRes.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;

    if (!args) {
      return new Response(
        JSON.stringify({ error: "no_tool_response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        faceDetected: !!args.face_detected,
        dominantEmotion: args.dominant_emotion,
        confidence: Math.round(args.confidence ?? 0),
        emotions: args.emotions ?? {},
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ai-vision-mood] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
