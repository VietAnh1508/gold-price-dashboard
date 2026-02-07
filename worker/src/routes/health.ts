import type { Env } from "../types/env";
import { getHealthSnapshot } from "../observability/state";

export async function healthHandler(_env: Env): Promise<Response> {
  const snapshot = getHealthSnapshot();
  return Response.json({
    ok: true,
    version: "0.1.0",
    startedAt: snapshot.startedAt,
    lastQuoteServedAt: snapshot.lastQuoteServedAt,
    upstreamStatus: snapshot.upstreamStatus,
  });
}
