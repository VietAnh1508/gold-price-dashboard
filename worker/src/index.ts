import { debugHandler } from "./routes/debug";
import { healthHandler } from "./routes/health";
import { quoteHandler } from "./routes/quote";
import type { Env } from "./types/env";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (pathname === "/api/quote" && req.method === "GET") {
      return quoteHandler(req, env);
    }
    if (pathname === "/api/health" && req.method === "GET") {
      return healthHandler(env);
    }
    if (pathname === "/api/debug" && req.method === "GET") {
      return debugHandler(req, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
