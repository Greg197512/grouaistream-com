import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://grouaistream.com'
const AD_PRICE_EUR = 5

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e').replace(/ł/g,'l')
    .replace(/ń/g,'n').replace(/ó/g,'o').replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const body = await req.json()
    const {
      token,
      company_name,
      contact_email,
      ad_title,
      ad_description,
      ad_url,
      ad_image_url,
      industry,
    } = body

    if (!token || !company_name || !contact_email || !ad_title || !ad_description || !ad_url) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (ad_title.length > 120 || ad_description.length > 600) {
      return new Response(JSON.stringify({ error: 'fields_too_long' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    try { new URL(ad_url) } catch {
      return new Response(JSON.stringify({ error: 'invalid_url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (ad_image_url) {
      try { new URL(ad_image_url) } catch {
        return new Response(JSON.stringify({ error: 'invalid_image_url' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: lead } = await supabase
      .from('ad_leads')
      .select('id, email')
      .eq('outreach_token', token)
      .maybeSingle()

    const baseSlug = slugify(`${company_name}-${ad_title}`)
    const slug = `ad-${baseSlug}-${Date.now().toString(36)}`
    const postUrl = `${SITE_URL}/blog/${slug}`

    const blogContent = `> 💡 **Reklama partnera** · ${company_name}\n\n` +
      `# ${ad_title}\n\n` +
      `${ad_description}\n\n` +
      (ad_image_url ? `![${ad_title}](${ad_image_url})\n\n` : '') +
      `---\n\n` +
      `🔗 **Sprawdź ofertę:** [${ad_url}](${ad_url})\n\n` +
      `*Reklama opublikowana przez ${company_name}. Kontakt: ${contact_email}*`

    const { data: post, error: postError } = await supabase
      .from('seo_blog_posts')
      .insert({
        title: `[Partner] ${ad_title}`,
        slug,
        description: ad_description.slice(0, 160),
        content: blogContent,
        category: 'partner-ads',
        cover_url: ad_image_url || null,
        is_published: true,
        generated_by_ai: false,
        tags: ['reklama', 'partner', industry || 'general'].filter(Boolean),
      })
      .select('id')
      .single()

    if (postError) {
      console.error('Post insert error', postError)
      return new Response(JSON.stringify({ error: 'blog_post_failed', details: postError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: campaign, error: campError } = await supabase
      .from('ad_campaigns')
      .insert({
        lead_id: lead?.id || null,
        blog_post_id: post.id,
        company_name,
        contact_email,
        ad_title,
        ad_description,
        ad_url,
        ad_image_url: ad_image_url || null,
        industry: industry || null,
        amount_eur: AD_PRICE_EUR,
        payment_status: 'pending',
        publish_status: 'live',
      })
      .select('id, payment_deadline')
      .single()

    if (campError) {
      console.error('Campaign insert error', campError)
      return new Response(JSON.stringify({ error: 'campaign_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (lead?.id) {
      await supabase.from('ad_leads').update({ status: 'converted', reply_received_at: new Date().toISOString() }).eq('id', lead.id)
    }

    await Promise.allSettled([
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'admin-notification',
          recipientEmail: 'kontakt@grouaistream.com',
          templateData: {
            title: `Nowa reklama: ${company_name}`,
            message: `Firma "${company_name}" opublikowała reklamę "${ad_title}".\n\nKwota: ${AD_PRICE_EUR} €\nDeadline płatności: ${campaign.payment_deadline}\nKontakt: ${contact_email}\nLink do wpisu: ${postUrl}`,
          },
          idempotencyKey: `ad-campaign-admin-${campaign.id}`,
        },
      }),
      supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'ad-submission-confirmation',
          recipientEmail: contact_email,
          templateData: {
            company_name,
            contact_email,
            ad_title,
            ad_description,
            ad_url,
            ad_image_url: ad_image_url || null,
            industry: industry || null,
            amount_eur: AD_PRICE_EUR,
            payment_deadline: campaign.payment_deadline,
            post_url: postUrl,
          },
          idempotencyKey: `ad-campaign-confirmation-${campaign.id}`,
        },
      }),
    ])

    return new Response(JSON.stringify({
      ok: true,
      campaign_id: campaign.id,
      post_slug: slug,
      payment_deadline: campaign.payment_deadline,
      amount_eur: AD_PRICE_EUR,
      post_url: postUrl,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('ad-campaign-submit error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
