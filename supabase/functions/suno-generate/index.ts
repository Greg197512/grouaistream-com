import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUNO_API_BASE = 'https://api.sunoapi.org/api/v1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Check status of a generation task
    if (action === 'status' && taskId) {
      const statusRes = await fetch(`${SUNO_API_BASE}/generate/record?taskId=${taskId}`, {
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

    // Generate music
    const isCustom = !!(style || title);
    // Build the Supabase project URL for callback
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const callBackUrl = `${supabaseUrl}/functions/v1/suno-generate`;

    const generateBody: any = {
      customMode: isCustom,
      instrumental: instrumental || false,
      model: 'V4',
      callBackUrl,
    };

    if (isCustom) {
      generateBody.prompt = prompt || ''; // lyrics in custom mode
      generateBody.style = style || 'Pop';
      generateBody.title = title || 'AI Generated Track';
    } else {
      generateBody.prompt = prompt || 'A catchy upbeat pop song with modern beats';
    }

    console.log('[Suno] Generating with body:', JSON.stringify(generateBody));

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

    console.log('[Suno] Generate response:', JSON.stringify(genData));

    return new Response(JSON.stringify(genData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[Suno] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
