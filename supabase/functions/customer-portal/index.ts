import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authenticate user from the JWT in Authorization header
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: 'portal' | 'cancel' = body.action || 'portal';
    const env: PaddleEnv = (body.environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;

    // Lookup the user's subscription for this env
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('paddle_subscription_id, paddle_customer_id, status')
      .eq('user_id', user.id)
      .eq('environment', env)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'no_subscription' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paddle = getPaddleClient(env);

    if (action === 'cancel') {
      // Cancel at end of billing period (grace period)
      await paddle.subscriptions.cancel(sub.paddle_subscription_id, {
        effectiveFrom: 'next_billing_period',
      });
      // Reflect locally; webhook will arrive shortly with the canonical state
      await supabase.from('subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('paddle_subscription_id', sub.paddle_subscription_id)
        .eq('environment', env);

      return new Response(JSON.stringify({ ok: true, action: 'cancel_scheduled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: portal
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id]
    );

    const url = session.urls?.subscriptions?.[0]?.cancelSubscription
      || session.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod
      || session.urls?.general?.overview;

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[customer-portal] error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
