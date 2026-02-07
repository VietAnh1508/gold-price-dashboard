import type { UpstreamStatus } from "../types/contracts";
import { serializeError } from "../utils/errors";

export type UpstreamSource = "spot" | "fx" | "retail";
type QuoteCacheLayer = "memory" | "edge";

interface UpstreamRuntimeState {
  status: UpstreamStatus | "unknown";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: Record<string, unknown> | null;
  lastStaleServedAt: string | null;
}

interface CacheCounter {
  hits: number;
  misses: number;
}

interface ObservabilityState {
  startedAt: string;
  counters: {
    quoteRequests: number;
    debugUnauthorized: number;
    debugAuthorized: number;
    quoteCache: Record<QuoteCacheLayer, CacheCounter>;
    sourceDataCache: Record<UpstreamSource, CacheCounter>;
    upstreamFetches: Record<UpstreamSource, CacheCounter>;
    staleServes: Record<UpstreamSource, number>;
  };
  upstream: Record<UpstreamSource, UpstreamRuntimeState>;
  lastQuoteServedAt: string | null;
}

const createCounter = (): CacheCounter => ({ hits: 0, misses: 0 });
const createUpstreamState = (): UpstreamRuntimeState => ({
  status: "unknown",
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  lastStaleServedAt: null,
});

const state: ObservabilityState = {
  startedAt: new Date().toISOString(),
  counters: {
    quoteRequests: 0,
    debugUnauthorized: 0,
    debugAuthorized: 0,
    quoteCache: {
      memory: createCounter(),
      edge: createCounter(),
    },
    sourceDataCache: {
      spot: createCounter(),
      fx: createCounter(),
      retail: createCounter(),
    },
    upstreamFetches: {
      spot: createCounter(),
      fx: createCounter(),
      retail: createCounter(),
    },
    staleServes: {
      spot: 0,
      fx: 0,
      retail: 0,
    },
  },
  upstream: {
    spot: createUpstreamState(),
    fx: createUpstreamState(),
    retail: createUpstreamState(),
  },
  lastQuoteServedAt: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

export function recordQuoteRequest(): void {
  state.counters.quoteRequests += 1;
}

export function recordQuoteCacheHit(layer: QuoteCacheLayer): void {
  state.counters.quoteCache[layer].hits += 1;
}

export function recordQuoteCacheMiss(layer: QuoteCacheLayer): void {
  state.counters.quoteCache[layer].misses += 1;
}

export function recordSourceDataCacheHit(source: UpstreamSource): void {
  state.counters.sourceDataCache[source].hits += 1;
}

export function recordSourceDataCacheMiss(source: UpstreamSource): void {
  state.counters.sourceDataCache[source].misses += 1;
}

export function recordUpstreamAttempt(source: UpstreamSource): void {
  state.upstream[source].lastAttemptAt = nowIso();
}

export function recordUpstreamSuccess(source: UpstreamSource): void {
  state.counters.upstreamFetches[source].hits += 1;
  state.upstream[source].lastSuccessAt = nowIso();
  state.upstream[source].lastError = null;
}

export function recordUpstreamFailure(source: UpstreamSource, error: unknown): void {
  state.counters.upstreamFetches[source].misses += 1;
  state.upstream[source].lastErrorAt = nowIso();
  state.upstream[source].lastError = serializeError(error);
}

export function recordStaleServe(source: UpstreamSource): void {
  state.counters.staleServes[source] += 1;
  state.upstream[source].lastStaleServedAt = nowIso();
}

export function recordUpstreamStatusSnapshot(status: Record<UpstreamSource, UpstreamStatus>): void {
  state.upstream.spot.status = status.spot;
  state.upstream.fx.status = status.fx;
  state.upstream.retail.status = status.retail;
  state.lastQuoteServedAt = nowIso();
}

export function recordDebugAuth(isAuthorized: boolean): void {
  if (isAuthorized) {
    state.counters.debugAuthorized += 1;
    return;
  }
  state.counters.debugUnauthorized += 1;
}

export function getHealthSnapshot(): {
  startedAt: string;
  lastQuoteServedAt: string | null;
  upstreamStatus: Record<UpstreamSource, UpstreamStatus | "unknown">;
} {
  return {
    startedAt: state.startedAt,
    lastQuoteServedAt: state.lastQuoteServedAt,
    upstreamStatus: {
      spot: state.upstream.spot.status,
      fx: state.upstream.fx.status,
      retail: state.upstream.retail.status,
    },
  };
}

export function getDebugSnapshot(): {
  startedAt: string;
  lastQuoteServedAt: string | null;
  counters: ObservabilityState["counters"];
  upstream: ObservabilityState["upstream"];
} {
  return {
    startedAt: state.startedAt,
    lastQuoteServedAt: state.lastQuoteServedAt,
    counters: structuredClone(state.counters),
    upstream: structuredClone(state.upstream),
  };
}
