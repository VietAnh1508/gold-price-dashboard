import type { Env } from "../types/env";

export interface FxResult {
  rate: number;
  providerTimestamp: string;
}

export async function fetchUsdVndRate(_env: Env): Promise<FxResult> {
  throw new Error("Not implemented: A5 FX provider integration");
}
