import type { Env } from "../types/env";

export interface RetailResult {
  buyVndLuong: number;
  sellVndLuong: number;
  asOf: string;
}

const VNAPPMOB_API_BASE_URL = "https://api.vnappmob.com";

interface VnappmobRetailPayload {
  results?: unknown;
}

type RetailBrand = "sjc" | "doji" | "pnj";

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseAsOf(record: Record<string, unknown>, fetchedAtIso: string): string {
  const candidates = [
    record.asOf,
    record.as_of,
    record.updated_at,
    record.update_at,
    record.datetime,
    record.date,
    record.timestamp,
    record.time,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const ms = Date.parse(candidate);
      if (Number.isFinite(ms)) return new Date(ms).toISOString();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const ms = candidate > 1e12 ? candidate : candidate * 1000;
      return new Date(ms).toISOString();
    }
  }

  return fetchedAtIso;
}

function parseSjc(record: Record<string, unknown>): { buyVndLuong: number; sellVndLuong: number } | null {
  const buy = parseFiniteNumber(record.buy_1l);
  const sell = parseFiniteNumber(record.sell_1l);
  if (buy === null || sell === null || buy <= 0 || sell <= 0) return null;
  return { buyVndLuong: buy, sellVndLuong: sell };
}

function parseCityBrand(
  record: Record<string, unknown>,
  city?: string,
): { buyVndLuong: number; sellVndLuong: number } | null {
  const normalizedCity = city?.trim().toLowerCase();
  const cityCandidates = normalizedCity ? [normalizedCity] : [];
  cityCandidates.push("hcm", "hn");

  for (const cityCode of cityCandidates) {
    const buy = parseFiniteNumber(record[`buy_${cityCode}`]);
    const sell = parseFiniteNumber(record[`sell_${cityCode}`]);
    if (buy !== null && sell !== null && buy > 0 && sell > 0) {
      return { buyVndLuong: buy, sellVndLuong: sell };
    }
  }

  // Fallback to first available buy_*/sell_* pair if city-specific keys are unknown.
  const entries = Object.entries(record);
  for (const [key, value] of entries) {
    if (!key.startsWith("buy_")) continue;
    const suffix = key.slice(4);
    const buy = parseFiniteNumber(value);
    const sell = parseFiniteNumber(record[`sell_${suffix}`]);
    if (buy !== null && sell !== null && buy > 0 && sell > 0) {
      return { buyVndLuong: buy, sellVndLuong: sell };
    }
  }

  return null;
}

export async function fetchRetailPrice(
  env: Env,
  brand: RetailBrand,
  city?: string,
): Promise<RetailResult> {
  const fetchedAtIso = new Date().toISOString();
  const response = await fetch(`${VNAPPMOB_API_BASE_URL}/api/v2/gold/${brand}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.VNAPPMOB_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`vnappmob retail request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as VnappmobRetailPayload;
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    throw new Error("vnappmob retail response missing results");
  }

  const firstRecord = payload.results[0];
  if (!firstRecord || typeof firstRecord !== "object") {
    throw new Error("vnappmob retail response missing record");
  }

  const record = firstRecord as Record<string, unknown>;
  const parsedPrice = brand === "sjc" ? parseSjc(record) : parseCityBrand(record, city);

  if (!parsedPrice) {
    throw new Error(`vnappmob retail response missing valid buy/sell for ${brand}`);
  }

  return {
    ...parsedPrice,
    asOf: parseAsOf(record, fetchedAtIso),
  };
}
