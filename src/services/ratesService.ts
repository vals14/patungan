import { supabase } from '../lib/supabase'

export interface RateResult {
  rate: number
  date: string
  source: 'live' | 'fallback'
}

// Fetches "units of `to` per 1 unit of `from`" via the rates-service edge function.
// The frontend has no knowledge of which FX provider is behind the function.
// Returns null on any failure — callers fall back to manual rate entry, never block.
export async function getExchangeRate(
  from: string,
  to: string,
  date?: string
): Promise<RateResult | null> {
  if (from === to) return { rate: 1, date: date ?? new Date().toISOString().slice(0, 10), source: 'live' }

  try {
    const { data, error } = await supabase.functions.invoke('rates-service', {
      body: { from, to, date },
    })
    if (error || data?.error || typeof data?.rate !== 'number') return null
    return { rate: data.rate, date: data.date, source: data.source }
  } catch {
    return null
  }
}
