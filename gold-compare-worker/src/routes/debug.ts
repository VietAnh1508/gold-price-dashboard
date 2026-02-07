import type { Env } from "../types/env";

export async function debugHandler(req: Request, env: Env): Promise<Response> {
  const secret = req.headers.get("x-debug-secret");
  if (!secret || secret !== env.DEBUG_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({
    ok: true,
    message: "Not implemented: add counters, cache stats, and last fetch times.",
  });
}
