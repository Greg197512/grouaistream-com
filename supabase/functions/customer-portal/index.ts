import { createClient } from 'npm:@supabase/supabase-js@2';
import { getPaddleClient, gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

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
    const action: 'portal' | 'cancel' | 'change_plan' = body.action || 'portal';
    const env: PaddleEnv = (body.environment === 'live' ? 'live' : 'sandbox') as PaddleEnv;

    // Multiple subscription rows may exist per (user, env) after re-subscribe / plan change.
    // Pick the newest one so cancel / change_plan / portal actions target the current subscription.
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('paddle_subscription_id, paddle_customer_id, status, current_period_end, price_id')
      .eq('user_id', user.id)
      .eq('environment', env)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'no_subscription' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paddle = getPaddleClient(env);

    // -------- CANCEL --------
    if (action === 'cancel') {
      await paddle.subscriptions.cancel(sub.paddle_subscription_id, {
        effectiveFrom: 'next_billing_period',
      });
      await supabase.from('subscriptions')
        .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
        .eq('paddle_subscription_id', sub.paddle_subscription_id)
        .eq('environment', env);

      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'subscription-canceled',
          recipientEmail: user.email,
          idempotencyKey: `sub-canceled-${sub.paddle_subscription_id}`,
          templateData: {
            displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Tam',
            periodEnd: sub.current_period_end,
          },
        },
      }).catch((e) => console.error('[customer-portal] cancel email failed:', e));

      return new Response(JSON.stringify({ ok: true, action: 'cancel_scheduled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------- CHANGE PLAN (proration) --------
    if (action === 'change_plan') {
      const newPriceExternalId: string = body.newPriceId; // e.g. grouai_ultimate_monthly
      if (!newPriceExternalId) {
        return new Response(JSON.stringify({ error: 'newPriceId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (newPriceExternalId === sub.price_id) {
        return new Response(JSON.stringify({ error: 'already_on_this_plan' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Resolve external_id → Paddle internal id
      const lookup = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(newPriceExternalId)}`);
      const lookupJson = await lookup.json();
      const newPaddlePriceId = lookupJson?.data?.[0]?.id;
      if (!newPaddlePriceId) {
        return new Response(JSON.stringify({ error: 'price_not_found', priceId: newPriceExternalId }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update subscription with proration (immediate switch + pro-rated charge)
      await paddle.subscriptions.update(sub.paddle_subscription_id, {
        items: [{ priceId: newPaddlePriceId, quantity: 1 }],
        prorationBillingMode: 'prorated_immediately',
      } as any);

      console.log('[customer-portal] plan changed:', user.id, sub.price_id, '→', newPriceExternalId);

      return new Response(JSON.stringify({ ok: true, action: 'plan_changed', newPriceId: newPriceExternalId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------- PORTAL --------
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id]
    );

    const url = session.urls?.general?.overview
      || session.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod
      || session.urls?.subscriptions?.[0]?.cancelSubscription;

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
