import type { QuoteResponse } from "../types/contracts";
import { getMemoryCache, setMemoryCache } from "../cache/memory";
import { fetchUsdVndRate, type FxResult } from "../services/fx";
import { fetchRetailPrice, type RetailResult } from "../services/retail";
import { fetchSpotGold, type SpotResult } from "../services/spot";
import type { Env } from "../types/env";
import { DEFAULT_BRAND, LUONG_GRAMS, OZT_GRAMS, SUPPORTED_BRANDS } from "../utils/constants";
import { serializeError } from "../utils/errors";

const DEFAULT_QUOTE_TTL_SECONDS = 120;
const DEFAULT_FX_CACHE_TTL_SECONDS = 60 * 60 * 6;
const STALE_DATA_TTL_SECONDS = 60 * 60 * 6;

interface SourceOutcome<T> {
  status: "ok" | "stale" | "error";
  data: T | null;
}

interface CachedQuote {
  quote: QuoteResponse;
}

function parseTtlSeconds(rawTtl: string | undefined, fallback: number): number {
  if (!rawTtl) return fallback;
  const parsed = Number.parseInt(rawTtl, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createBaseQuote(brand: "sjc" | "doji" | "pnj", ttlSeconds: number): QuoteResponse {
  return {
    meta: {
      serverTime: new Date().toISOString(),
      cacheTtlSeconds: ttlSeconds,
      dataFreshnessSeconds: 0,
    },
    spot: {
      provider: "gold-api.com",
      symbol: "XAU",
      currency: "USD",
      price_usd_ozt: null,
      providerTimestamp: null,
    },
    fx: {
      provider: "vnappmob",
      providerName: null,
      pair: "USD/VND",
      rate: null,
      providerTimestamp: null,
    },
    computed: {
      luong_grams: LUONG_GRAMS,
      ozt_grams: OZT_GRAMS,
      spot_vnd_luong: null,
    },
    retail: {
      provider: "vnappmob",
      brand,
      buy_vnd_luong: null,
      sell_vnd_luong: null,
      asOf: null,
    },
    comparison: {
      premium_buy_vnd: null,
      premium_buy_pct: null,
      premium_sell_vnd: null,
      premium_sell_pct: null,
    },
    status: {
      spot: "error",
      fx: "error",
      retail: "error",
    },
  };
}

function deriveFreshnessSeconds(quote: QuoteResponse, nowMs: number): number {
  const timestamps = [quote.spot.providerTimestamp, quote.fx.providerTimestamp, quote.retail.asOf]
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, Math.floor((nowMs - value) / 1000)));

  if (timestamps.length === 0) {
    return 0;
  }

  return Math.max(...timestamps);
}

function withFreshMeta(quote: QuoteResponse, ttlSeconds: number): QuoteResponse {
  const nowMs = Date.now();
  return {
    ...quote,
    fx: {
      ...quote.fx,
      providerName: quote.fx.providerName ?? null,
    },
    meta: {
      serverTime: new Date(nowMs).toISOString(),
      cacheTtlSeconds: ttlSeconds,
      dataFreshnessSeconds: deriveFreshnessSeconds(quote, nowMs),
    },
  };
}

async function fetchWithFallback<T>(
  source: "spot" | "fx" | "retail",
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<SourceOutcome<T>> {
  const fresh = getMemoryCache<T>(key);
  if (fresh) {
    return { status: "ok", data: fresh };
  }

  try {
    const fetched = await fetcher();
    setMemoryCache(key, fetched, ttlSeconds);
    setMemoryCache(`${key}:stale`, fetched, STALE_DATA_TTL_SECONDS);
    return { status: "ok", data: fetched };
  } catch (error) {
    console.error("upstream_fetch_failed", {
      source,
      cacheKey: key,
      error: serializeError(error),
    });
    const stale = getMemoryCache<T>(`${key}:stale`);
    if (stale) {
      return { status: "stale", data: stale };
    }
    return { status: "error", data: null };
  }
}

function buildEdgeCacheKey(req: Request, brand: "sjc" | "doji" | "pnj", city?: string): Request {
  const cacheUrl = new URL(req.url);
  cacheUrl.search = "";
  cacheUrl.searchParams.set("retailBrand", brand);
  if (city && city.trim().length > 0) {
    cacheUrl.searchParams.set("retailCity", city);
  }
  return new Request(cacheUrl.toString(), { method: "GET" });
}

async function getEdgeCachedQuote(
  cache: Cache,
  key: Request,
  ttlSeconds: number,
): Promise<CachedQuote | null> {
  const cachedResponse = await cache.match(key);
  if (!cachedResponse) return null;

  try {
    const parsed = (await cachedResponse.json()) as CachedQuote;
    if (parsed && typeof parsed === "object" && parsed.quote) {
      return {
        quote: withFreshMeta(parsed.quote, ttlSeconds),
      };
    }
  } catch (error) {
    console.warn("edge_cache_parse_failed", {
      error: serializeError(error),
    });
    return null;
  }

  return null;
}

async function setEdgeCachedQuote(
  cache: Cache,
  key: Request,
  cachedQuote: CachedQuote,
  ttlSeconds: number,
): Promise<void> {
  const response = new Response(JSON.stringify(cachedQuote), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=0, s-maxage=${ttlSeconds}`,
    },
  });
  await cache.put(key, response);
}

export async function quoteHandler(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const brand = (url.searchParams.get("retailBrand") ?? DEFAULT_BRAND).toLowerCase();
  const city = url.searchParams.get("retailCity") ?? undefined;

  if (!SUPPORTED_BRANDS.includes(brand as (typeof SUPPORTED_BRANDS)[number])) {
    return Response.json({ error: "unsupported retailBrand" }, { status: 400 });
  }

  const normalizedBrand = brand as "sjc" | "doji" | "pnj";
  const quoteTtlSeconds = parseTtlSeconds(env.QUOTE_CACHE_TTL_SECONDS, DEFAULT_QUOTE_TTL_SECONDS);
  const fxCacheTtlSeconds = parseTtlSeconds(env.FX_CACHE_TTL_SECONDS, DEFAULT_FX_CACHE_TTL_SECONDS);
  const edgeCache = await caches.open("gold-quote-cache");
  const quoteCacheKey = `quote:${normalizedBrand}:${city ?? "-"}`;
  const cachedQuote = getMemoryCache<CachedQuote>(quoteCacheKey);
  if (cachedQuote) {
    return Response.json(withFreshMeta(cachedQuote.quote, quoteTtlSeconds));
  }

  const edgeCacheKey = buildEdgeCacheKey(req, normalizedBrand, city);
  const edgeCachedQuote = await getEdgeCachedQuote(edgeCache, edgeCacheKey, quoteTtlSeconds);
  if (edgeCachedQuote) {
    setMemoryCache(quoteCacheKey, edgeCachedQuote, quoteTtlSeconds);
    return Response.json(edgeCachedQuote.quote);
  }

  const [spotResult, fxResult, retailResult] = await Promise.all([
    fetchWithFallback<SpotResult>("spot", "spot:latest", quoteTtlSeconds, () => fetchSpotGold()),
    fetchWithFallback<FxResult>("fx", "fx:latest", fxCacheTtlSeconds, () => fetchUsdVndRate(env)),
    fetchWithFallback<RetailResult>("retail", `retail:${normalizedBrand}:${city ?? "-"}`, quoteTtlSeconds, () =>
      fetchRetailPrice(env, normalizedBrand, city),
    ),
  ]);

  const quote = createBaseQuote(normalizedBrand, quoteTtlSeconds);
  quote.status.spot = spotResult.status;
  quote.status.fx = fxResult.status;
  quote.status.retail = retailResult.status;

  if (spotResult.data) {
    quote.spot.price_usd_ozt = spotResult.data.priceUsdOzt;
    quote.spot.providerTimestamp = spotResult.data.providerTimestamp;
  }
  if (fxResult.data) {
    quote.fx.provider = `vnappmob:${fxResult.data.provider}`;
    quote.fx.providerName = fxResult.data.providerName;
    quote.fx.rate = fxResult.data.rate;
    quote.fx.providerTimestamp = fxResult.data.providerTimestamp;
  }
  if (retailResult.data) {
    quote.retail.buy_vnd_luong = retailResult.data.buyVndLuong;
    quote.retail.sell_vnd_luong = retailResult.data.sellVndLuong;
    quote.retail.asOf = retailResult.data.asOf;
  }

  if (quote.spot.price_usd_ozt !== null && quote.fx.rate !== null) {
    quote.computed.spot_vnd_luong =
      quote.spot.price_usd_ozt * (quote.computed.luong_grams / quote.computed.ozt_grams) * quote.fx.rate;
  }

  if (quote.computed.spot_vnd_luong !== null) {
    if (quote.retail.buy_vnd_luong !== null) {
      quote.comparison.premium_buy_vnd = quote.retail.buy_vnd_luong - quote.computed.spot_vnd_luong;
      quote.comparison.premium_buy_pct = (quote.comparison.premium_buy_vnd / quote.computed.spot_vnd_luong) * 100;
    }
    if (quote.retail.sell_vnd_luong !== null) {
      quote.comparison.premium_sell_vnd = quote.retail.sell_vnd_luong - quote.computed.spot_vnd_luong;
      quote.comparison.premium_sell_pct = (quote.comparison.premium_sell_vnd / quote.computed.spot_vnd_luong) * 100;
    }
  }

  const responseBody = withFreshMeta(quote, quoteTtlSeconds);
  const allCriticalMissing =
    responseBody.spot.price_usd_ozt === null &&
    responseBody.fx.rate === null &&
    responseBody.retail.buy_vnd_luong === null &&
    responseBody.retail.sell_vnd_luong === null;

  if (!allCriticalMissing) {
    setMemoryCache(quoteCacheKey, { quote }, quoteTtlSeconds);
    await setEdgeCachedQuote(edgeCache, edgeCacheKey, { quote }, quoteTtlSeconds);
  }

  return Response.json(responseBody, { status: allCriticalMissing ? 503 : 200 });
}
