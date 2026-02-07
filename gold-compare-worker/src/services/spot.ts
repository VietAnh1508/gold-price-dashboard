export interface SpotResult {
  priceUsdOzt: number;
  providerTimestamp: string;
}

export async function fetchSpotGold(): Promise<SpotResult> {
  throw new Error("Not implemented: A2 spot provider integration");
}
