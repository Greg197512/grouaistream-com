import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log('[payments-webhook] event:', event.eventType, 'env:', env);

    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionResumed:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionPaused:
        await handleSubscription(event.data, env);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data, env);
        break;
      case EventName.TransactionPaymentFailed:
        console.log('[payments-webhook] payment failed:', event.data.id);
        break;
      case 'adjustment.created' as any:
      case 'adjustment.updated' as any:
        await handleAdjustment(event.data, env);
        break;
      default:
        console.log('[payments-webhook] unhandled:', event.eventType);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[payments-webhook] error:', e);
    return new Response('Webhook error: ' + String(e), { status: 400 });
  }
});

async function handleSubscription(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error('[payments-webhook] no userId in customData');
    return;
  }

  const item = items[0];
  const priceId = item?.price?.importMeta?.externalId || item?.price?.id;
  const productId = item?.price?.productId
    ? (await getProductExternalId(item.price.productId, env)) || item.price.productId
    : 'unknown';

  await supabase.from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: id,
    paddle_customer_id: customerId,
    product_id: productId,
    price_id: priceId,
    status,
    current_period_start: currentBillingPeriod?.startsAt,
    current_period_end: currentBillingPeriod?.endsAt,
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,environment' });

  console.log('[payments-webhook] subscription synced:', userId, productId, status);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await supabase.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  if (data.subscriptionId) return;

  const { id, customerId, items, customData, details } = data;
  const item = items?.[0];
  if (!item) return;

  const priceExternal = item.price?.importMeta?.externalId || item.price?.id;
  if (!priceExternal?.startsWith('grouai_coffee')) return;

  const userId = customData?.userId || null;
  let recipientUserId: string | null = customData?.recipientUserId || null;
  let recipientTrackId: string | null = customData?.recipientTrackId || null;
  const totalCents = Number(details?.totals?.grandTotal || item.price?.unitPrice?.amount || 0);
  const amount = totalCents / 100;

  if (!recipientUserId || !recipientTrackId) {
    const { data: rnd } = await supabase.rpc('get_random_tippable_track');
    if (rnd && rnd.length > 0) {
      recipientTrackId = rnd[0].track_id;
      recipientUserId = rnd[0].owner_user_id;
      console.log('[payments-webhook] rotating tip → creator:', recipientUserId, 'track:', recipientTrackId);
    } else {
      console.log('[payments-webhook] no tippable tracks, tip stays with platform');
    }
  }

  await supabase.from('one_time_purchases').insert({
    user_id: userId,
    paddle_transaction_id: id,
    paddle_customer_id: customerId,
    product_id: 'grouai_coffee',
    price_id: priceExternal,
    amount,
    currency: (item.price?.unitPrice?.currencyCode || 'usd').toLowerCase(),
    recipient_user_id: recipientUserId,
    recipient_track_id: recipientTrackId,
    environment: env,
  });

  if (recipientUserId && recipientTrackId) {
    await supabase.from('creator_earnings').insert({
      user_id: recipientUserId,
      track_id: recipientTrackId,
      amount: amount * 0.9,
      earning_type: 'tip',
      description: `Kup kawę ☕ ${amount.toFixed(2)}€ (90% twórcy)`,
    });
  }

  console.log('[payments-webhook] coffee tip recorded:', amount, '→', recipientUserId);
}

/**
 * Refund / chargeback handling.
 * When Paddle issues an adjustment (refund or chargeback) for a one_time_purchase,
 * mark it refunded and reverse the creator earning.
 */
async function handleAdjustment(data: any, env: PaddleEnv) {
  const { transactionId, action, status } = data;
  if (action !== 'refund' && action !== 'chargeback') return;
  if (status !== 'approved' && status !== 'pending_approval') return;

  // Find the original purchase
  const { data: purchase } = await supabase
    .from('one_time_purchases')
    .select('id, recipient_user_id, recipient_track_id, amount, refunded_at')
    .eq('paddle_transaction_id', transactionId)
    .eq('environment', env)
    .maybeSingle();

  if (!purchase || purchase.refunded_at) {
    console.log('[payments-webhook] adjustment: no purchase or already refunded:', transactionId);
    return;
  }

  // Mark refunded
  await supabase.from('one_time_purchases')
    .update({ refunded_at: new Date().toISOString() })
    .eq('id', purchase.id);

  // Reverse creator earning (negative entry — keeps audit trail)
  if (purchase.recipient_user_id && purchase.recipient_track_id) {
    await supabase.from('creator_earnings').insert({
      user_id: purchase.recipient_user_id,
      track_id: purchase.recipient_track_id,
      amount: -(Number(purchase.amount) * 0.9),
      earning_type: 'refund',
      description: `Zwrot kawy ☕ ${purchase.amount}€ (cofnięto 90% twórcy)`,
    });
  }

  console.log('[payments-webhook] adjustment processed:', transactionId, action);
}

async function getProductExternalId(paddleProductId: string, env: PaddleEnv): Promise<string | null> {
  try {
    const { gatewayFetch } = await import('../_shared/paddle.ts');
    const res = await gatewayFetch(env, `/products/${paddleProductId}`);
    const json = await res.json();
    return json.data?.import_meta?.external_id || json.data?.importMeta?.externalId || null;
  } catch {
    return null;
  }
}
