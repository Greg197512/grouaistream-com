import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Wysyła newsletter z nowym wpisem blogowym do wszystkich potwierdzonych userów,
 * którzy nie wypisali się z newslettera (profiles.blog_newsletter_opt_out = false)
 * i nie są na liście suppressed_emails.
 *
 * Body: { post_id: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const postId: string | undefined = body.post_id;
    if (!postId) throw new Error("post_id required");

    // Auth: must be admin
    const authHeader = req.headers.get("Authorization");
    let triggeredBy: string | null = null;
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        triggeredBy = userData.user.id;
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (!isAdmin) throw new Error("admin only");
      } else {
        throw new Error("unauthenticated");
      }
    } else {
      throw new Error("auth required");
    }

    // Load post + hook
    const { data: post, error: postErr } = await supabase
      .from("seo_blog_posts")
      .select("id, slug, title, description, category, cover_url")
      .eq("id", postId)
      .maybeSingle();
    if (postErr || !post) throw new Error("post not found");

    const { data: hook } = await supabase
      .from("blog_post_hooks")
      .select("email_hook, email_subject")
      .eq("post_id", postId)
      .maybeSingle();

    // Create log entry
    const { data: logEntry } = await supabase
      .from("blog_newsletter_log")
      .insert({
        post_id: postId,
        triggered_by: triggeredBy,
        status: "sending",
      })
      .select()
      .single();

    // Fetch all confirmed users via admin API (paginated)
    const recipients: Array<{ id: string; email: string; name?: string }> = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      const users = data?.users || [];
      for (const u of users) {
        if (u.email && u.email_confirmed_at) {
          recipients.push({ id: u.id, email: u.email });
        }
      }
      if (users.length < 1000) break;
      page++;
      if (page > 20) break; // safety
    }

    // Filter out opt-outs and suppressed
    const userIds = recipients.map((r) => r.id);
    const emails = recipients.map((r) => r.email);

    const { data: optedOut } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    const optOutMap = new Map<string, { display_name: string | null; opt: boolean }>();
    // re-query opt_out since previous select may not include the column on some setups
    const { data: profilesFull } = await supabase
      .from("profiles")
      .select("user_id, display_name, blog_newsletter_opt_out")
      .in("user_id", userIds);
    for (const p of profilesFull || []) {
      optOutMap.set((p as any).user_id, {
        display_name: (p as any).display_name,
        opt: (p as any).blog_newsletter_opt_out === true,
      });
    }

    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email")
      .in("email", emails);
    const suppressedSet = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));

    const finalRecipients = recipients.filter(
      (r) =>
        !suppressedSet.has(r.email.toLowerCase()) &&
        !(optOutMap.get(r.id)?.opt === true)
    );

    let success = 0;
    let errors = 0;
    const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const r of finalRecipients) {
      try {
        // Generate unsubscribe token
        const { data: tokenRow } = await supabase
          .from("email_unsubscribe_tokens")
          .insert({
            email: r.email,
            token: crypto.randomUUID(),
          })
          .select("token")
          .single();
        const unsubscribeUrl = `https://grouaistream.com/unsubscribe?token=${tokenRow?.token || ""}`;

        const resp = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            template: "new-blog-post",
            to: r.email,
            data: {
              recipientName: optOutMap.get(r.id)?.display_name || null,
              postTitle: post.title,
              postDescription: post.description,
              postSlug: post.slug,
              postCoverUrl: post.cover_url,
              emailHook: hook?.email_hook || null,
              subject: hook?.email_subject || `📝 ${post.title}`,
              category: post.category,
              unsubscribeUrl,
            },
          }),
        });
        if (resp.ok) success++;
        else errors++;
      } catch {
        errors++;
      }
    }

    await supabase
      .from("blog_newsletter_log")
      .update({
        recipients_count: finalRecipients.length,
        success_count: success,
        error_count: errors,
        status: errors === 0 ? "sent" : success > 0 ? "partial" : "failed",
      })
      .eq("id", logEntry?.id);

    await supabase.rpc("log_seo_activity", {
      _action_type: "newsletter_send",
      _level: errors === 0 ? "success" : "warning",
      _message: `Newsletter wysłany: ${success}/${finalRecipients.length} (błędy: ${errors})`,
      _metadata: { post_id: postId, slug: post.slug },
      _triggered_by: "manual",
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipients: finalRecipients.length,
        sent: success,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
