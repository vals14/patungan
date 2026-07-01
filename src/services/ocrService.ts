import { supabase } from '../lib/supabase'

export interface OcrLineItem {
  name: string
  amount: number
}

export interface OcrResult {
  line_items: OcrLineItem[]
  tax: number
  service: number
  discount: number
  total: number
  currency: string
}

// Sends a base64 image to the ocr-service edge function and returns normalized line items.
// The frontend has no knowledge of which OCR provider is behind the function.
export async function scanReceipt(imageBase64: string, filename?: string): Promise<OcrResult> {
  const { data, error } = await supabase.functions.invoke('ocr-service', {
    body: { imageBase64, filename },
  })

  if (error) {
    // A non-2xx from the function comes back as a FunctionsHttpError whose
    // `context` is the raw Response — pull its body so we see the real cause
    // (missing secret, Mindee 401/404, wrong endpoint, etc.) instead of a
    // generic message.
    let detail = error.message ?? String(error)
    try {
      const ctx = (error as any).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json()
        if (body?.error) detail = body.detail ? `${body.error} — ${body.detail}` : body.error
      } else if (ctx && typeof ctx.text === 'function') {
        detail = await ctx.text()
      }
    } catch {
      /* keep the original message if the body can't be parsed */
    }
    console.error('[ocr] invoke error:', detail, error)
    throw new Error(`Scan failed: ${detail}`)
  }
  if (data?.error) {
    console.error('[ocr] function returned error:', data)
    throw new Error(data.detail ? `${data.error} — ${data.detail}` : data.error)
  }

  return {
    line_items: data.line_items ?? [],
    tax: data.tax ?? 0,
    service: data.service ?? 0,
    discount: data.discount ?? 0,
    total: data.total ?? 0,
    currency: data.currency ?? 'IDR',
  }
}

// Uploads a receipt image to Supabase Storage and returns a signed URL valid for 1 year.
// Returns null on any failure — a missing receipt image must never block saving the expense.
export async function uploadReceiptImage(
  imageBase64: string,
  userId: string
): Promise<string | null> {
  try {
    const cleaned = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    const binary = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0))
    const path = `${userId}/${Date.now()}.jpg`

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, binary, { contentType: 'image/jpeg', upsert: false })

    if (error) return null

    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    return data?.signedUrl ?? null
  } catch {
    return null
  }
}
