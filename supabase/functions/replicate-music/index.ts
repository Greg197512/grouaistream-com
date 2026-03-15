import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { prompt, title, genre, instrumental, customApiKey } = await req.json();

    const REPLICATE_KEY = customApiKey || Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_KEY) {
      return new Response(JSON.stringify({ error: "Brak klucza Replicate API. Dodaj go w Ustawieniach." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert generation record
    const { data: gen, error: insertErr } = await supabase.from("generations").insert({
      user_id: userId,
      title: title || "Untitled",
      genre: genre || "Pop",
      prompt,
      instrumental: instrumental || false,
      status: "generating",
    }).select().single();

    if (insertErr) throw insertErr;

    // Call Replicate API
    const replicateRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "671ac645ce5e552cc63a54a2bbff63fcf798043055f2a04b1d735e6ee09b7bd6",
        input: {
          model_version: "stereo-large",
          prompt: prompt,
          duration: 30,
          output_format: "mp3",
          normalization_strategy: "peak",
        },
      }),
    });

    if (!replicateRes.ok) {
      const errText = await replicateRes.text();
      console.error("Replicate error:", replicateRes.status, errText);
      
      await supabase.from("generations").update({ status: "failed" }).eq("id", gen.id);
      
      return new Response(JSON.stringify({ 
        error: "Serwer generowania muzyki jest zajęty. Spróbuj ponownie za chwilę.",
        generationId: gen.id,
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await replicateRes.json();
    
    // Handle async prediction (polling)
    let audioUrl = prediction.output;
    if (!audioUrl && prediction.status !== "succeeded") {
      // Poll for result
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_KEY}` },
        });
        const pollData = await pollRes.json();
        
        if (pollData.status === "succeeded") {
          audioUrl = pollData.output;
          break;
        } else if (pollData.status === "failed" || pollData.status === "canceled") {
          await supabase.from("generations").update({ status: "failed" }).eq("id", gen.id);
          return new Response(JSON.stringify({ error: "Generowanie nie powiodło się.", generationId: gen.id }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        attempts++;
      }
    }

    if (!audioUrl) {
      await supabase.from("generations").update({ status: "failed" }).eq("id", gen.id);
      return new Response(JSON.stringify({ error: "Timeout - spróbuj ponownie." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update generation with audio URL
    await supabase.from("generations").update({
      audio_url: audioUrl,
      status: "completed",
      replicate_id: prediction.id,
    }).eq("id", gen.id);

    return new Response(JSON.stringify({
      success: true,
      generationId: gen.id,
      audioUrl,
      title: title || "Untitled",
      genre,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
