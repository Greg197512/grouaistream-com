import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function getCorsHeaders(_req: Request) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const SUNO_API_BASE = 'https://api.sunoapi.org/api/v1';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- Authentication check ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // --- End authentication ---

  const SUNO_API_KEY = Deno.env.get('SUNO_API_KEY');
  if (!SUNO_API_KEY) {
    return new Response(JSON.stringify({ error: 'SUNO_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { action, prompt, style, title, instrumental, taskId } = body;

    if (action === 'status' && taskId) {
      const statusRes = await fetch(`${SUNO_API_BASE}/generate/record-info?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${SUNO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      const statusData = await statusRes.json();
      if (!statusRes.ok) {
        throw new Error(`Suno status check failed [${statusRes.status}]: ${JSON.stringify(statusData)}`);
      }

      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isCustom = !!(style || title);
    const callBackUrl = `${supabaseUrl}/functions/v1/suno-generate`;

    const generateBody: any = {
      customMode: isCustom,
      instrumental: instrumental || false,
      model: 'V4',
      callBackUrl,
    };

    if (isCustom) {
      generateBody.prompt = prompt || '';
      generateBody.style = style || 'Pop';
      generateBody.title = title || 'AI Generated Track';
    } else {
      generateBody.prompt = prompt || 'A catchy upbeat pop song with modern beats';
    }

    const genRes = await fetch(`${SUNO_API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUNO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(generateBody),
    });

    const genData = await genRes.json();
    if (!genRes.ok) {
      throw new Error(`Suno generate failed [${genRes.status}]: ${JSON.stringify(genData)}`);
    }

    return new Response(JSON.stringify(genData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Suno] Error:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
