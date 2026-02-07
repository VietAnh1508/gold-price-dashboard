export interface SpotResult {
  priceUsdOzt: number;
  providerTimestamp: string;
}

const GOLD_API_SPOT_URL = "https://api.gold-api.com/price/XAU";

interface GoldApiSpotResponse {
  name?: unknown;
  price?: unknown;
  symbol?: unknown;
  updatedAt?: unknown;
  updatedAtReadable?: unknown;
  timestamp?: unknown;
}

function parseIsoTimestamp(rawTimestamp: unknown, fetchedAtIso: string): string {
  if (typeof rawTimestamp === "string") {
    const ms = Date.parse(rawTimestamp);
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString();
    }
  }

  if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    const ms = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
    return new Date(ms).toISOString();
  }

  return fetchedAtIso;
}

export async function fetchSpotGold(): Promise<SpotResult> {
  const fetchedAtIso = new Date().toISOString();
  const response = await fetch(GOLD_API_SPOT_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`gold-api spot request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as GoldApiSpotResponse;
  const price =
    typeof payload.price === "number"
      ? payload.price
      : typeof payload.price === "string"
      ? Number.parseFloat(payload.price)
      : Number.NaN;

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("gold-api spot response missing valid price");
  }

  return {
    priceUsdOzt: price,
    providerTimestamp: parseIsoTimestamp(payload.updatedAt ?? payload.timestamp, fetchedAtIso),
  };
}
