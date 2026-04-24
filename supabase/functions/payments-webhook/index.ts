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

  // Aurora R2 storage fulfillment — auto-grant storage plan if priceId matches
  if (typeof priceId === 'string' && priceId.startsWith('aurora_storage_')) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(userId);
      const email = u?.user?.email || customData?.email || null;
      const { data: subId, error: fulfillErr } = await supabase.rpc('aurora_storage_fulfill_from_paddle', {
        _user_id: userId,
        _email: email,
        _price_external_id: priceId,
        _paddle_subscription_id: id,
        _current_period_end: currentBillingPeriod?.endsAt || null,
        _status: status,
      });
      if (fulfillErr) {
        console.error('[payments-webhook] aurora storage fulfill error:', fulfillErr);
      } else {
        console.log('[payments-webhook] aurora storage subscription:', subId);
      }
    } catch (e) {
      console.error('[payments-webhook] aurora storage fulfill exception:', e);
    }
  }
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
  const { id, customData, items, currentBillingPeriod, scheduledChange } = data;

  await supabase.from('subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: scheduledChange?.action === 'cancel',
      current_period_end: currentBillingPeriod?.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', id)
    .eq('environment', env);

  const userId = customData?.userId;
  if (!userId) return;

  const priceExt = items?.[0]?.price?.importMeta?.externalId || '';
  const planName = priceExt.includes('ultimate') ? 'Ultimate' : 'Pro';
  const periodEnd = currentBillingPeriod?.endsAt || null;

  // In-app event
  await supabase.from('payment_events').upsert({
    user_id: userId,
    event_type: 'subscription_canceled',
    paddle_subscription_id: id,
    plan: planName,
    period_end: periodEnd,
    environment: env,
  }, { onConflict: 'event_type,paddle_subscription_id,environment' }).then(({ error }) => {
    if (error) console.error('[payments-webhook] payment_events upsert (canceled) err:', error);
  });

  // Email
  const { data: u } = await supabase.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  const displayName = u?.user?.user_metadata?.display_name || email?.split('@')[0] || 'tam';
  if (email) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'subscription-canceled',
        recipientEmail: email,
        idempotencyKey: `sub-canceled-${id}`,
        templateData: { displayName, periodEnd, isReminder: false },
      },
    }).catch((e) => console.error('[payments-webhook] sub-canceled email err:', e));
  }
}

async function handleTransactionPaymentFailed(data: any, env: PaddleEnv) {
  const { id, customData, items, subscriptionId, payments } = data;
  const userId = customData?.userId;
  console.log('[payments-webhook] transaction.payment_failed:', id);
  if (!userId) return;

  const item = items?.[0];
  const priceExt = item?.price?.importMeta?.externalId || '';
  const planName = priceExt.includes('ultimate')
    ? 'Ultimate'
    : priceExt.includes('pro')
      ? 'Pro'
      : (priceExt.startsWith('grouai_coffee') ? 'Coffee' : '—');

  const totalCents = Number(item?.price?.unitPrice?.amount ?? 0);
  const amount = totalCents / 100;
  const currency = (item?.price?.unitPrice?.currencyCode || 'USD').toLowerCase();
  const reason = payments?.[0]?.errorCode || payments?.[0]?.status || null;

  // In-app event
  await supabase.from('payment_events').upsert({
    user_id: userId,
    event_type: 'payment_failed',
    paddle_transaction_id: id,
    paddle_subscription_id: subscriptionId || null,
    plan: planName,
    amount,
    currency,
    reason,
    environment: env,
  }, { onConflict: 'event_type,paddle_transaction_id,environment' }).then(({ error }) => {
    if (error) console.error('[payments-webhook] payment_events upsert (failed) err:', error);
  });

  // Email
  const { data: u } = await supabase.auth.admin.getUserById(userId);
  const email = u?.user?.email;
  const displayName = u?.user?.user_metadata?.display_name || email?.split('@')[0] || 'tam';
  if (email) {
    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'payment-failed',
        recipientEmail: email,
        idempotencyKey: `payment-failed-txn-${id}`,
        templateData: { displayName, planName },
      },
    }).catch((e) => console.error('[payments-webhook] payment-failed email err:', e));
  }
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const { id, customerId, items, customData, details, subscriptionId, billedAt, invoice, invoiceId } = data;
  const item = items?.[0];
  if (!item) return;

  const priceExternal = item.price?.importMeta?.externalId || item.price?.id;

  // ---- Path A: Subscription transaction (Pro/Ultimate) → record + receipt email
  if (subscriptionId) {
    await handleSubscriptionTransaction(data, env);
    return;
  }

  // ---- Path B: Track Boost (one-time, paid via Paddle) ----
  if (priceExternal?.startsWith('grouai_boost')) {
    const userId = customData?.userId || null;
    const boostTrackId = customData?.boostTrackId || null;
    const boostPackage = customData?.boostPackage || 'basic';
    const totalCents = Number(details?.totals?.grandTotal || item.price?.unitPrice?.amount || 0);
    const amount = totalCents / 100;

    if (!userId || !boostTrackId) {
      console.error('[payments-webhook] boost: missing userId/boostTrackId in customData', customData);
      return;
    }

    // Idempotent activation (track_boosts.paddle_transaction_id is UNIQUE)
    const { data: actResult, error: actErr } = await supabase.rpc('activate_boost_paid', {
      _user_id: userId,
      _track_id: boostTrackId,
      _package: boostPackage,
      _amount: amount,
      _paddle_transaction_id: id,
    });

    if (actErr) {
      console.error('[payments-webhook] boost activation error:', actErr);
      return;
    }

    // Record in one_time_purchases for accounting parity with coffee
    await supabase.from('one_time_purchases').insert({
      user_id: userId,
      paddle_transaction_id: id,
      paddle_customer_id: customerId,
      product_id: 'grouai_boost',
      price_id: priceExternal,
      amount,
      currency: (item.price?.unitPrice?.currencyCode || 'eur').toLowerCase(),
      recipient_user_id: userId,
      recipient_track_id: boostTrackId,
      environment: env,
    });

    // Emit agent event for analytics / brain
    await supabase.from('agent_events').insert({
      event_type: 'boost.purchased',
      source: 'payments-webhook',
      actor_user_id: userId,
      target_type: 'track',
      target_id: boostTrackId,
      payload: { package: boostPackage, amount, currency: 'eur', paddle_transaction_id: id, env },
    }).then(() => {}, (e) => console.error('[payments-webhook] agent_event err:', e));

    console.log('[payments-webhook] boost activated:', userId, boostTrackId, amount, '→', actResult);
    return;
  }

  // ---- Path C: Coffee tip (one-time) — existing flow
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

/**
 * Subscription transaction (Pro/Ultimate billing event).
 * Records to paddle_transactions, fetches invoice URL, sends receipt email.
 */
async function handleSubscriptionTransaction(data: any, env: PaddleEnv) {
  const { id, customerId, items, customData, details, subscriptionId, billedAt } = data;
  const item = items?.[0];
  if (!item) return;

  const userId = customData?.userId;
  const priceExternal = item.price?.importMeta?.externalId || item.price?.id || '';
  const productExternal = item.price?.productId
    ? (await getProductExternalId(item.price.productId, env)) || item.price.productId
    : 'unknown';

  const planName =
    productExternal === 'grouai_ultimate' ? 'Ultimate' :
    productExternal === 'grouai_pro' ? 'Pro' :
    productExternal;

  const cycle = item.price?.billingCycle?.interval as string | undefined;
  const cycleLabel = cycle === 'year' ? 'rocznie' : cycle === 'month' ? 'miesięcznie' : undefined;

  const totalCents = Number(details?.totals?.grandTotal ?? item.price?.unitPrice?.amount ?? 0);
  const currency = (details?.totals?.currencyCode || item.price?.unitPrice?.currencyCode || 'usd').toUpperCase();
  const amount = totalCents / 100;

  // Best-effort: fetch invoice PDF URL from Paddle
  let invoiceUrl: string | null = null;
  try {
    const { gatewayFetch } = await import('../_shared/paddle.ts');
    const invRes = await gatewayFetch(env, `/transactions/${id}/invoice`);
    if (invRes.ok) {
      const invJson = await invRes.json();
      invoiceUrl = invJson?.data?.url ?? null;
    }
  } catch (e) {
    console.warn('[payments-webhook] invoice fetch failed:', String(e));
  }

  const { error: insertErr } = await supabase.from('paddle_transactions').upsert({
    user_id: userId || null,
    paddle_transaction_id: id,
    paddle_subscription_id: subscriptionId || null,
    paddle_customer_id: customerId || null,
    product_id: productExternal,
    price_id: priceExternal,
    plan: planName,
    amount,
    currency: currency.toLowerCase(),
    status: 'completed',
    billed_at: billedAt || new Date().toISOString(),
    invoice_url: invoiceUrl,
    environment: env,
  }, { onConflict: 'paddle_transaction_id,environment' });

  if (insertErr) console.error('[payments-webhook] paddle_transactions upsert failed:', insertErr);

  let nextBilledAt: string | null = null;
  if (subscriptionId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('current_period_end')
      .eq('paddle_subscription_id', subscriptionId)
      .maybeSingle();
    nextBilledAt = sub?.current_period_end ?? null;
  }

  if (userId) {
    const { data: u } = await supabase.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    const displayName = u?.user?.user_metadata?.display_name || email?.split('@')[0] || 'tam';
    if (email) {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'subscription-receipt',
          recipientEmail: email,
          idempotencyKey: `sub-receipt-${id}`,
          templateData: {
            displayName, planName, cycleLabel, amount, currency,
            billedAt: billedAt || new Date().toISOString(),
            transactionId: id, invoiceUrl, nextBilledAt,
          },
        },
      }).catch((e) => console.error('[payments-webhook] receipt email error:', e));
    }
  }

  console.log('[payments-webhook] subscription txn recorded:', id, planName, amount, currency);
}
