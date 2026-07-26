// Paddle webhook handler.
// Registered destination: https://<project>.supabase.co/functions/v1/payments-webhook?env=live|sandbox
//
// Responsibilities:
//  1. Verify Paddle signature via the shared helper.
//  2. Upsert `subscriptions` on subscription.* events (grace period preserved on cancel).
//  3. Record `paddle_transactions` on transaction.completed / payment_failed.
//  4. For coffee tips (grouai_coffee_*), write `one_time_purchases` and a 30-day-hold
//     `creator_earnings` row worth 90% of the tip when customData.recipientUserId is set.
//  5. Append `payment_events` for a full audit trail.
//
// Env-scoped by `?env=` query param so sandbox and live never mix.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paddle-signature',
};

let _supabase: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
  }
  return _supabase;
}

// Map external product id → app plan tier. Anything not listed is a one-time item.
const PRODUCT_TO_PLAN: Record<string, 'pro' | 'ultimate'> = {
  grouai_pro: 'pro',
  grouai_ultimate: 'ultimate',
};

function isCoffeePrice(externalId: string | undefined | null): boolean {
  return !!externalId && externalId.startsWith('grouai_coffee');
}

async function logEvent(row: {
  user_id?: string | null;
  event_type: string;
  paddle_transaction_id?: string | null;
  paddle_subscription_id?: string | null;
  plan?: string | null;
  amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  period_end?: string | null;
  environment: PaddleEnv;
}) {
  await db().from('payment_events').insert(row).then(({ error }) => {
    if (error) console.error('[payments-webhook] payment_events insert failed:', error);
  });
}

async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv) {
  const {
    id,
    customerId,
    items,
    status,
    currentBillingPeriod,
    scheduledChange,
    customData,
  } = data;

  const userId = customData?.userId;
  if (!userId) {
    console.warn('[payments-webhook] skipping subscription without customData.userId', id);
    return;
  }

  const item = items?.[0];
  const priceExternalId = item?.price?.importMeta?.externalId ?? null;
  const productExternalId = item?.product?.importMeta?.externalId ?? null;
  if (!priceExternalId || !productExternalId) {
    console.warn(
      '[payments-webhook] missing importMeta.externalId on subscription — skipping',
      { subscription: id, rawPrice: item?.price?.id, rawProduct: item?.product?.id },
    );
    return;
  }

  await db().from('subscriptions').upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productExternalId,
      price_id: priceExternalId,
      status,
      current_period_start: currentBillingPeriod?.startsAt ?? null,
      current_period_end: currentBillingPeriod?.endsAt ?? null,
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'paddle_subscription_id' },
  );

  await logEvent({
    user_id: userId,
    event_type: `subscription.${status}`,
    paddle_subscription_id: id,
    plan: PRODUCT_TO_PLAN[productExternalId] ?? productExternalId,
    period_end: currentBillingPeriod?.endsAt ?? null,
    environment: env,
  });
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Grace period: keep row so has_active_subscription() can honor current_period_end.
  const { id, customerId, currentBillingPeriod, customData } = data;
  await db().from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true,
      current_period_end: currentBillingPeriod?.endsAt ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  await logEvent({
    user_id: customData?.userId ?? null,
    event_type: 'subscription.canceled',
    paddle_subscription_id: id,
    period_end: currentBillingPeriod?.endsAt ?? null,
    environment: env,
  });
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const {
    id: transactionId,
    subscriptionId,
    customerId,
    customData,
    details,
    items,
    currencyCode,
    billedAt,
    invoiceNumber,
  } = data;

  const userId = customData?.userId ?? null;
  const totalCents = Number(details?.totals?.total ?? 0);
  const amount = totalCents ? totalCents / 100 : null;

  const item = items?.[0];
  const priceExternalId = item?.price?.importMeta?.externalId ?? null;
  // Transaction events don't carry the product object — derive product via priceId if we need it.
  const productId = item?.price?.productId ?? null;

  // Idempotent: unique on paddle_transaction_id.
  await db().from('paddle_transactions').upsert(
    {
      user_id: userId,
      paddle_transaction_id: transactionId,
      paddle_subscription_id: subscriptionId ?? null,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceExternalId,
      plan: null,
      amount,
      currency: currencyCode,
      status: 'completed',
      billed_at: billedAt ?? null,
      invoice_url: invoiceNumber ?? null,
      environment: env,
    },
    { onConflict: 'paddle_transaction_id' },
  );

  // Coffee tip → one_time_purchases + creator_earnings (30-day hold).
  if (isCoffeePrice(priceExternalId)) {
    const recipientUserId = customData?.recipientUserId ?? null;
    const recipientTrackId = customData?.recipientTrackId ?? null;

    await db().from('one_time_purchases').upsert(
      {
        user_id: userId,
        paddle_transaction_id: transactionId,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceExternalId,
        amount,
        currency: currencyCode,
        recipient_user_id: recipientUserId,
        recipient_track_id: recipientTrackId,
        environment: env,
      },
      { onConflict: 'paddle_transaction_id' },
    );

    if (recipientUserId && amount) {
      const creatorCut = Number((amount * 0.9).toFixed(2));
      const availableAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db().from('creator_earnings').insert({
        user_id: recipientUserId,
        track_id: recipientTrackId,
        amount: creatorCut,
        earning_type: 'tip',
        description: `Coffee tip (${priceExternalId}) — payable after 30-day refund window`,
        available_at: availableAt,
      });
    }
  }

  await logEvent({
    user_id: userId,
    event_type: 'transaction.completed',
    paddle_transaction_id: transactionId,
    paddle_subscription_id: subscriptionId ?? null,
    amount,
    currency: currencyCode,
    environment: env,
  });
}

async function handleTransactionPaymentFailed(data: any, env: PaddleEnv) {
  const { id, subscriptionId, customData, details, currencyCode } = data;
  const userId = customData?.userId ?? null;
  const amountCents = Number(details?.totals?.total ?? 0);

  await logEvent({
    user_id: userId,
    event_type: 'transaction.payment_failed',
    paddle_transaction_id: id,
    paddle_subscription_id: subscriptionId ?? null,
    amount: amountCents ? amountCents / 100 : null,
    currency: currencyCode,
    reason: 'payment_failed',
    environment: env,
  });
  // Note: we do NOT downgrade the plan here — dunning keeps access per policy.
  //       Paddle will emit subscription.updated with status="past_due" (still Pro)
  //       and eventually subscription.canceled if all retries fail.
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') === 'live' ? 'live' : 'sandbox') as PaddleEnv;

  try {
    const event: any = await verifyWebhook(req, env);
    console.log('[payments-webhook]', env, event.eventType, event.data?.id);

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
        await handleSubscriptionCreatedOrUpdated(event.data, env);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data, env);
        break;
      case EventName.TransactionPaymentFailed:
        await handleTransactionPaymentFailed(event.data, env);
        break;
      default:
        console.log('[payments-webhook] unhandled event', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[payments-webhook] error:', e);
    // Return 400 so Paddle retries only on genuine failures (bad signature = won't retry).
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
