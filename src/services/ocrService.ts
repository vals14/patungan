import { supabase } from '../lib/supabase'

export interface OcrLineItem {
  name: string
  amount: number
}

export interface OcrResult {
  line_items: OcrLineItem[]
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
    throw new Error('Could not read the receipt. Try again or enter items manually.')
  }
  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    line_items: data.line_items ?? [],
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
