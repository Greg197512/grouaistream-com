// Public lookup leadu po outreach_token (zwraca tylko bezpieczne pola dla formularza)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)
  const token = url.searchParams.get('token') || (await req.json().catch(() => ({}))).token

  if (!token) {
    return new Response(JSON.stringify({ error: 'missing_token' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('ad_leads')
    .select('email, company_name, website, industry, country')
    .eq('outreach_token', token)
    .maybeSingle()

  if (error || !data) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, lead: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
