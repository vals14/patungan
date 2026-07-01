// ocr-service: the ONLY place the OCR provider is called.
// Swap providers by changing this file only. Frontend contract is fixed:
//   IN:  { imageBase64: string, filename?: string }
//   OUT: { line_items: { name: string, amount: number }[], total: number, currency: string }
//
// Provider: Claude vision (Anthropic Messages API). Reads messy/multilingual
// receipts well and returns structured JSON. Set ANTHROPIC_API_KEY as a secret.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
// Vision-capable Claude model; override via the OCR_MODEL secret if desired.
const OCR_MODEL = Deno.env.get('OCR_MODEL') ?? 'claude-sonnet-4-6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `You are a receipt parser. Extract the purchased line items and the receipt-level charges from this receipt image.
Respond with ONLY a JSON object (no markdown, no prose, no code fences) in exactly this shape:
{"line_items":[{"name":"string","amount":number}],"tax":number,"service":number,"discount":number,"total":number,"currency":"ISO"}
Rules:
- All amounts are plain numbers in the receipt's currency: no thousands separators, no currency symbols.
- "line_items" are the actual purchased products/services only. Do NOT include subtotal, tax, service charge, discount, rounding, or total as line items.
- "tax" is the total tax/VAT/PB1/PPN/GST amount (0 if none).
- "service" is the total service-charge amount (0 if none).
- "discount" is the total discount/promo amount as a POSITIVE number (0 if none).
- "total" is the grand total actually paid.
- "currency" is the 3-letter ISO 4217 code (e.g. IDR, USD, SGD, EUR). Infer it from symbols/language/context; if truly unknown use "IDR".
- If you cannot read individual items but can read a total, return an empty "line_items" array with the total.
- If the image is not a receipt, return {"line_items":[],"tax":0,"service":0,"discount":0,"total":0,"currency":"IDR"}.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[ocr-service] request received; ANTHROPIC_API_KEY present:', !!ANTHROPIC_API_KEY, 'model:', OCR_MODEL)

    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY secret is not set on the edge function. Add it under Edge Functions -> Manage secrets and redeploy.' }, 500)
    }

    const { imageBase64 } = await req.json()
    if (!imageBase64) {
      return json({ error: 'imageBase64 is required' }, 400)
    }
    // Accept either a raw base64 string or a data URI.
    const cleaned = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    console.log('[ocr-service] imageBase64 length:', cleaned.length)

    const claudeRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cleaned } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    })

    console.log('[ocr-service] Claude responded with status:', claudeRes.status)
    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('[ocr-service] Claude error body:', errText)
      return json({ error: `OCR provider error: ${claudeRes.status}`, detail: errText }, 502)
    }

    const data = await claudeRes.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const parsed = extractJson(text)
    if (!parsed) {
      console.error('[ocr-service] could not parse JSON from model output:', text.slice(0, 300))
      return json({ error: 'Could not parse the receipt. Try a clearer photo or enter items manually.' }, 502)
    }

    // Normalize into the fixed contract.
    const rawItems: any[] = Array.isArray(parsed.line_items) ? parsed.line_items : []
    const line_items = rawItems
      .map((item) => ({
        name: (item?.name ?? '').toString().trim() || 'Item',
        amount: Number(item?.amount ?? 0),
      }))
      .filter((item) => item.amount > 0)

    const tax = Math.max(0, Number(parsed.tax ?? 0))
    const service = Math.max(0, Number(parsed.service ?? 0))
    const discount = Math.max(0, Number(parsed.discount ?? 0))
    const total = Number(parsed.total ?? 0)
    const currency = (parsed.currency ?? 'IDR').toString().toUpperCase().slice(0, 3)

    // Always give the review screen something to edit.
    if (line_items.length === 0 && total > 0) {
      // Fall back to a single item = total minus the charges, so the itemized
      // split still reconciles to the grand total once charges are re-added.
      const base = Math.max(0, total - tax - service + discount)
      line_items.push({ name: 'Total (no items detected)', amount: base || total })
    }

    console.log('[ocr-service] parsed', line_items.length, 'items; tax:', tax, 'service:', service, 'discount:', discount, 'total:', total, currency)
    return json({ line_items, tax, service, discount, total, currency })
  } catch (e) {
    console.error('[ocr-service] exception:', e)
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Pull the first JSON object out of the model's text, tolerating stray prose or
// ```json fences even though the prompt asks for raw JSON.
function extractJson(text: string): any | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}
