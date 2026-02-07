/// <reference types="@cloudflare/workers-types" />

interface Env {
  GOLD_API: Fetcher;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  return context.env.GOLD_API.fetch(context.request);
};
