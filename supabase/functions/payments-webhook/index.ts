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
      case EventName.SubscriptionPaused:
      case 'subscription.trialing' as any:
        await handleSubscription(event.data, env);
        break;
      case EventName.SubscriptionPastDue:
        await handleSubscriptionPastDue(event.data, env);
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

/**
 * Past-due policy: immediate downgrade to free + email notification.
 * (User chose: "Email + natychmiast free")
 */
async function handleSubscriptionPastDue(data: any, env: PaddleEnv) {
  const { id, customData, items } = data;
  const userId = customData?.userId;

  // Mark as canceled locally — entitlement check filters status NOT IN ('canceled')
  await supabase.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  if (!userId) return;

  // Lookup user email + plan name
  const { data: userRow } = await supabase.auth.admin.getUserById(userId);
  const email = userRow?.user?.email;
  const displayName = userRow?.user?.user_metadata?.display_name || email?.split('@')[0] || 'tam';
  const priceExt = items?.[0]?.price?.importMeta?.externalId || '';
  const planName = priceExt.includes('ultimate') ? 'Ultimate' : 'Pro';

  if (email) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'payment-failed',
        recipientEmail: email,
        idempotencyKey: `payment-failed-${id}-${Date.now()}`,
        templateData: { displayName, planName },
      },
    }).catch((e) => console.error('[payments-webhook] payment-failed email error:', e));
  }
  console.log('[payments-webhook] past_due → downgraded:', userId);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await supabase.from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', data.id)
    .eq('environment', env);
}

async function handleTransactionPaymentFailed(data: any, env: PaddleEnv) {
  // Subscription past_due event handles the user notification — this is just a log
  console.log('[payments-webhook] transaction.payment_failed:', data.id);
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

  // Pick emoji based on tier
  const emoji = priceExternal === 'grouai_coffee_irish'
    ? '☕🥃'
    : priceExternal === 'grouai_coffee_latte'
      ? '☕🥛'
      : '☕';

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
      description: `Kup kawę ${emoji} ${amount.toFixed(2)}€ (90% twórcy)`,
    });
  }

  // ---- Emails: thanks (buyer) + received (creator) ----
  // Look up buyer
  let buyerEmail: string | null = null;
  let buyerName: string | undefined;
  if (userId) {
    const { data: u } = await supabase.auth.admin.getUserById(userId);
    buyerEmail = u?.user?.email ?? null;
    buyerName = u?.user?.user_metadata?.display_name || buyerEmail?.split('@')[0];
  }

  // Look up creator + track title
  let creatorEmail: string | null = null;
  let creatorName: string | undefined;
  let trackTitle: string | undefined;
  if (recipientUserId) {
    const { data: u } = await supabase.auth.admin.getUserById(recipientUserId);
    creatorEmail = u?.user?.email ?? null;
    creatorName = u?.user?.user_metadata?.display_name || creatorEmail?.split('@')[0];
  }
  if (recipientTrackId) {
    const { data: t } = await supabase.from('tracks').select('title').eq('id', recipientTrackId).maybeSingle();
    trackTitle = t?.title;
  }

  if (buyerEmail) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'coffee-tip-thanks',
        recipientEmail: buyerEmail,
        idempotencyKey: `coffee-thanks-${id}`,
        templateData: { displayName: buyerName, amount, emoji, recipientName: creatorName },
      },
    }).catch((e) => console.error('[payments-webhook] thanks email error:', e));
  }

  if (creatorEmail && creatorEmail !== buyerEmail) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'coffee-tip-received',
        recipientEmail: creatorEmail,
        idempotencyKey: `coffee-received-${id}`,
        templateData: { displayName: creatorName, amount, emoji, trackTitle, fromName: buyerName },
      },
    }).catch((e) => console.error('[payments-webhook] received email error:', e));
  }

  console.log('[payments-webhook] coffee tip recorded:', amount, '→', recipientUserId);
}

async function handleAdjustment(data: any, env: PaddleEnv) {
  const { transactionId, action, status } = data;
  if (action !== 'refund' && action !== 'chargeback') return;
  if (status !== 'approved' && status !== 'pending_approval') return;

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

  await supabase.from('one_time_purchases')
    .update({ refunded_at: new Date().toISOString() })
    .eq('id', purchase.id);

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
