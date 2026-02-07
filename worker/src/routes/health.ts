import type { Env } from "../types/env";

export async function healthHandler(_env: Env): Promise<Response> {
  return Response.json({
    ok: true,
    version: "0.1.0",
    upstreamStatus: {
      spot: "unknown",
      fx: "unknown",
      retail: "unknown",
    },
  });
}
