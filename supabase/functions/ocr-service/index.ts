// ocr-service: the ONLY place the OCR provider is called.
// Swap providers by changing this file only. Frontend contract is fixed:
//   IN:  { imageBase64: string, filename?: string }
//   OUT: { line_items: { name: string, amount: number }[], total: number, currency: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const MINDEE_API_KEY = Deno.env.get('MINDEE_API_KEY')!
// Mindee Receipt OCR v5 endpoint. Verify the current version path in your Mindee dashboard.
const MINDEE_URL = 'https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { imageBase64, filename } = await req.json()
    if (!imageBase64) {
      return json({ error: 'imageBase64 is required' }, 400)
    }

    // Mindee expects multipart/form-data with the file.
    const binary = base64ToUint8Array(imageBase64)
    const form = new FormData()
    form.append('document', new Blob([binary]), filename ?? 'receipt.jpg')

    const mindeeRes = await fetch(MINDEE_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${MINDEE_API_KEY}` },
      body: form,
    })

    if (!mindeeRes.ok) {
      const errText = await mindeeRes.text()
      return json({ error: `OCR provider error: ${mindeeRes.status}`, detail: errText }, 502)
    }

    const data = await mindeeRes.json()
    const prediction = data?.document?.inference?.prediction ?? {}

    // Normalize Mindee's shape into our fixed contract.
    // Mindee line_items: [{ description, total_amount, quantity, unit_price }]
    const rawItems: any[] = prediction.line_items ?? []
    const line_items = rawItems
      .map((item) => ({
        name: (item.description ?? '').toString().trim() || 'Item',
        amount: Number(item.total_amount ?? 0),
      }))
      .filter((item) => item.amount > 0)

    const total = Number(prediction.total_amount?.value ?? 0)
    const currency = (prediction.locale?.currency ?? 'IDR').toString()

    // If Mindee found a total but no usable line items, return a single fallback row
    // so the review screen always has something to edit rather than an empty list.
    if (line_items.length === 0 && total > 0) {
      line_items.push({ name: 'Total (no items detected)', amount: total })
    }

    return json({ line_items, total, currency })
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

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.includes(',') ? base64.split(',')[1] : base64
  const binaryString = atob(cleaned)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}
