// rates-service: the ONLY place the FX rate provider is called.
// Swap providers by changing this file only. Frontend contract is fixed:
//   IN:  { from: string, to: string, date?: string }   // date = YYYY-MM-DD, optional (defaults latest)
//   OUT: { rate: number, date: string, source: 'live' | 'fallback' }
//
// Provider: Frankfurter (https://api.frankfurter.dev). ECB data, working days only.
// "rate" means: units of `to` per 1 unit of `from`. amount_to = amount_from * rate.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Endpoint kept in an env var so a provider swap doesn't require code edits beyond this file.
const RATES_BASE_URL = Deno.env.get('RATES_BASE_URL') ?? 'https://api.frankfurter.dev/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { from, to, date } = await req.json()
    if (!from || !to) return json({ error: 'from and to are required' }, 400)

    // Same currency — no provider call needed.
    if (from === to) {
      return json({ rate: 1, date: date ?? today(), source: 'live' })
    }

    // Frankfurter v1: /{date}?base=FROM&symbols=TO  or  /latest?base=FROM&symbols=TO
    // Requesting a specific date returns the rate for the latest working day on/before it,
    // which gives us the weekend/holiday fallback for free.
    const datePath = date ? date : 'latest'
    const url = `${RATES_BASE_URL}/${datePath}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`

    const res = await fetch(url)
    if (!res.ok) {
      const detail = await res.text()
      return json({ error: `Rate provider error: ${res.status}`, detail }, 502)
    }

    const data = await res.json()
    const rate = data?.rates?.[to]
    if (typeof rate !== 'number') {
      return json({ error: `No rate found for ${from}->${to}` }, 404)
    }

    // If the returned date differs from the requested date, it was a non-working-day fallback.
    const returnedDate = data?.date ?? datePath
    const source = date && returnedDate !== date ? 'fallback' : 'live'

    return json({ rate, date: returnedDate, source })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
