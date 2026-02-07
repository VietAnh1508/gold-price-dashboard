export type RetailBrand = 'sjc' | 'doji' | 'pnj'
export type SourceStatus = 'ok' | 'stale' | 'error'

export interface QuoteResponse {
  meta: {
    serverTime: string
    cacheTtlSeconds: number
    dataFreshnessSeconds: number
  }
  spot: {
    provider: string
    symbol: string
    currency: string
    price_usd_ozt: number | null
    providerTimestamp: string | null
  }
  fx: {
    provider: string
    providerName?: string | null
    pair: string
    rate: number | null
    providerTimestamp: string | null
  }
  computed: {
    luong_grams: number
    ozt_grams: number
    spot_vnd_luong: number | null
  }
  retail: {
    provider: string
    brand: RetailBrand
    buy_vnd_luong: number | null
    sell_vnd_luong: number | null
    asOf: string | null
  }
  comparison: {
    premium_buy_vnd: number | null
    premium_buy_pct: number | null
    premium_sell_vnd: number | null
    premium_sell_pct: number | null
  }
  status: {
    spot: SourceStatus
    fx: SourceStatus
    retail: SourceStatus
  }
}
