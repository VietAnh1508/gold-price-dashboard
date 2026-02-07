import type { QuoteResponse, RetailBrand } from '../types'

export async function fetchQuote(retailBrand: RetailBrand, signal?: AbortSignal): Promise<QuoteResponse> {
  const query = new URLSearchParams({ retailBrand })
  const response = await fetch(`/api/quote?${query.toString()}`, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch quote (${response.status})`)
  }

  return (await response.json()) as QuoteResponse
}
