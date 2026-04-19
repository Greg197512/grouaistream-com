// Daily cron — finds subs canceling within next ~24-26h and sends reminder.
// Idempotent via subscription-id-based key, so re-runs are safe.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
  const in26h = new Date(now.getTime() + 26 * 3600 * 1000);

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('paddle_subscription_id, user_id, current_period_end')
    .eq('cancel_at_period_end', true)
    .gte('current_period_end', in24h.toISOString())
    .lt('current_period_end', in26h.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  for (const sub of subs || []) {
    const { data: u } = await supabase.auth.admin.getUserById(sub.user_id);
    if (!u?.user?.email) continue;

    const idempotencyKey = `sub-canceled-reminder-${sub.paddle_subscription_id}-${
      new Date(sub.current_period_end!).toISOString().slice(0, 10)
    }`;

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'subscription-canceled',
        recipientEmail: u.user.email,
        idempotencyKey,
        templateData: {
          displayName: u.user.user_metadata?.display_name || u.user.email.split('@')[0],
          periodEnd: sub.current_period_end,
          isReminder: true,
        },
      },
    }).catch((e) => console.error('reminder email failed:', e));

    sent++;
  }

  return new Response(JSON.stringify({ checked: subs?.length || 0, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
