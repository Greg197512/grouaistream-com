// Edge Function: ad-outreach-process
// Wywołane przez n8n z listą znalezionych leadów. Dedupuje, dodaje do bazy
// i wysyła profesjonalny email outreach (max 20/dzień).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://grouaistream.com'
const DAILY_LIMIT = 20
const REPLY_TO = 'kontakt@grouaistream.com'

interface Lead {
  email: string
  company_name?: string
  website?: string
  industry?: string
  country?: string
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

const BLOCKED_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'wp.pl', 'onet.pl', 'icloud.com']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const body = await req.json().catch(() => ({}))
    const leads: Lead[] = Array.isArray(body.leads) ? body.leads : []

    if (leads.length === 0) {
      return new Response(JSON.stringify({ error: 'No leads provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) Sprawdź dzienny limit
    const { data: countData } = await supabase.rpc('ad_outreach_daily_count')
    const sentToday: number = countData ?? 0
    const remaining = Math.max(0, DAILY_LIMIT - sentToday)

    if (remaining === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'daily_limit_reached', sent_today: sentToday }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) Dedup + validate
    const cleanLeads = leads
      .filter(l => l.email && isValidEmail(l.email))
      .filter(l => {
        const domain = l.email.toLowerCase().split('@')[1] || ''
        return !BLOCKED_DOMAINS.includes(domain)
      })
      .slice(0, remaining)

    if (cleanLeads.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_valid_leads' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3) Insert leadów (ignoruj duplikaty po lower(email))
    const inserts = cleanLeads.map(l => ({
      email: l.email.toLowerCase().trim(),
      company_name: l.company_name?.trim() || null,
      website: l.website?.trim() || null,
      industry: l.industry?.trim() || null,
      country: l.country?.trim() || null,
      source: 'firecrawl-n8n',
      status: 'queued',
    }))

    const { data: insertedLeads, error: insertError } = await supabase
      .from('ad_leads')
      .upsert(inserts, { onConflict: 'email', ignoreDuplicates: true })
      .select('id, email, company_name, outreach_token')

    if (insertError) {
      console.error('Insert error', insertError)
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const leadsToSend = insertedLeads || []
    let sentCount = 0
    const failures: string[] = []

    // 4) Wyślij emaile (po kolei, by nie zatłuc gateway)
    for (const lead of leadsToSend) {
      const ctaUrl = `${SITE_URL}/reklama/${lead.outreach_token}`

      try {
        const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'ad-outreach',
            recipientEmail: lead.email,
            templateData: {
              company_name: lead.company_name || '',
              cta_url: ctaUrl,
            },
            idempotencyKey: `ad-outreach-${lead.id}`,
          },
        })

        if (emailError) throw emailError

        await supabase.from('ad_leads').update({
          status: 'sent',
          contacted_at: new Date().toISOString(),
        }).eq('id', lead.id)

        sentCount++
        // Mała przerwa 500ms między mailami
        await new Promise(r => setTimeout(r, 500))
      } catch (e) {
        console.error(`Failed to send to ${lead.email}:`, e)
        failures.push(lead.email)
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      sent: sentCount,
      failed: failures.length,
      sent_today_total: sentToday + sentCount,
      remaining_today: DAILY_LIMIT - sentToday - sentCount,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('ad-outreach-process error', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
