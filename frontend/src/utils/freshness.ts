import type { QuoteResponse } from '../types'

interface FreshnessBadge {
  label: 'fresh' | 'stale'
  className: string
}

export function getFreshnessBadge(quote: QuoteResponse | null): FreshnessBadge {
  if (!quote) {
    return {
      label: 'stale',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  const hasNonOkSource = Object.values(quote.status).some((status) => status !== 'ok')
  const isOlderThanTtl = quote.meta.dataFreshnessSeconds > quote.meta.cacheTtlSeconds

  if (hasNonOkSource || isOlderThanTtl) {
    return {
      label: 'stale',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  return {
    label: 'fresh',
    className: 'bg-emerald-100 text-emerald-700',
  }
}
