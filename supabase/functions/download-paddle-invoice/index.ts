// Streams a Paddle invoice PDF back to the user, after verifying ownership.
// Always fetches a FRESH invoice URL from Paddle (the cached one expires).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body.transactionId || '').trim();
    const environment = (body.environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;
    if (!transactionId) return json({ error: 'transactionId required' }, 400);

    // Ownership check via service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: txn } = await supabaseAdmin
      .from('paddle_transactions')
      .select('user_id')
      .eq('paddle_transaction_id', transactionId)
      .eq('environment', environment)
      .maybeSingle();

    if (!txn || txn.user_id !== user.id) {
      return json({ error: 'Not found' }, 404);
    }

    // Fetch a fresh invoice URL (cached one in DB may be expired)
    const invRes = await gatewayFetch(environment, `/transactions/${transactionId}/invoice`);
    if (!invRes.ok) {
      const errText = await invRes.text();
      console.error('[download-paddle-invoice] paddle invoice err:', invRes.status, errText);
      return json({ error: 'Invoice not available' }, 502);
    }
    const invJson = await invRes.json();
    const url: string | undefined = invJson?.data?.url;
    if (!url) return json({ error: 'Invoice URL missing' }, 502);

    // Stream the PDF back so the browser saves it directly
    const pdfRes = await fetch(url);
    if (!pdfRes.ok || !pdfRes.body) {
      console.error('[download-paddle-invoice] pdf fetch err:', pdfRes.status);
      // Fallback to redirect
      return json({ url }, 200);
    }

    return new Response(pdfRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${transactionId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[download-paddle-invoice] error:', e);
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
