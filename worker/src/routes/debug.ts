import type { Env } from "../types/env";
import { getDebugSnapshot, getHealthSnapshot, recordDebugAuth } from "../observability/state";

export async function debugHandler(req: Request, env: Env): Promise<Response> {
  const secret = req.headers.get("x-debug-secret");
  const isAuthorized = Boolean(secret && secret === env.DEBUG_SECRET);
  recordDebugAuth(isAuthorized);
  if (!isAuthorized) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const health = getHealthSnapshot();
  const debug = getDebugSnapshot();

  return Response.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    upstreamStatus: health.upstreamStatus,
    lastFetchTimes: {
      spot: {
        attemptAt: debug.upstream.spot.lastAttemptAt,
        successAt: debug.upstream.spot.lastSuccessAt,
        errorAt: debug.upstream.spot.lastErrorAt,
        staleServedAt: debug.upstream.spot.lastStaleServedAt,
      },
      fx: {
        attemptAt: debug.upstream.fx.lastAttemptAt,
        successAt: debug.upstream.fx.lastSuccessAt,
        errorAt: debug.upstream.fx.lastErrorAt,
        staleServedAt: debug.upstream.fx.lastStaleServedAt,
      },
      retail: {
        attemptAt: debug.upstream.retail.lastAttemptAt,
        successAt: debug.upstream.retail.lastSuccessAt,
        errorAt: debug.upstream.retail.lastErrorAt,
        staleServedAt: debug.upstream.retail.lastStaleServedAt,
      },
    },
    counters: debug.counters,
    lastErrors: {
      spot: debug.upstream.spot.lastError,
      fx: debug.upstream.fx.lastError,
      retail: debug.upstream.retail.lastError,
    },
    worker: {
      startedAt: debug.startedAt,
      lastQuoteServedAt: debug.lastQuoteServedAt,
    },
  });
}
