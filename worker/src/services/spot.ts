import { parseIsoTimestamp } from "../utils/parsing";
import { UpstreamServiceError } from "../utils/errors";

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

export async function fetchSpotGold(): Promise<SpotResult> {
  const fetchedAtIso = new Date().toISOString();
  const requestUrl = GOLD_API_SPOT_URL;
  const response = await fetch(GOLD_API_SPOT_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new UpstreamServiceError("gold-api spot request failed", {
      service: "gold-api",
      operation: "fetchSpotGold",
      url: requestUrl,
      status: response.status,
      detail: body || undefined,
    });
  }

  const payload = (await response.json()) as GoldApiSpotResponse;
  const price =
    typeof payload.price === "number"
      ? payload.price
      : typeof payload.price === "string"
      ? Number.parseFloat(payload.price)
      : Number.NaN;

  if (!Number.isFinite(price) || price <= 0) {
    throw new UpstreamServiceError("gold-api spot response missing valid price", {
      service: "gold-api",
      operation: "fetchSpotGold",
      url: requestUrl,
    });
  }

  return {
    priceUsdOzt: price,
    providerTimestamp: parseIsoTimestamp(payload.updatedAt ?? payload.timestamp, fetchedAtIso),
  };
}
