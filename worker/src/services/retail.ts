import type { Env } from "../types/env";
import { VNAPPMOB_API_BASE_URL } from "../utils/constants";
import { fetchWithVnappmobToken } from "./token";
import { parseFiniteNumber, parseIsoTimestamp } from "../utils/parsing";
import { UpstreamServiceError } from "../utils/errors";

export interface RetailResult {
  sourceBrand: RetailBrand;
  buyVndLuong: number;
  sellVndLuong: number;
  asOf: string;
}

interface VnappmobRetailPayload {
  results?: unknown;
}

type RetailBrand = "sjc" | "doji" | "pnj";
const RETAIL_PROVIDER_PRIORITY: readonly RetailBrand[] = ["sjc", "doji", "pnj"];

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
    const parsed = parseIsoTimestamp(candidate, "");
    if (parsed) return parsed;
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
  const providerOrder = [brand, ...RETAIL_PROVIDER_PRIORITY.filter((candidate) => candidate !== brand)];
  const failureDetails: string[] = [];

  for (const provider of providerOrder) {
    const requestUrl = `${VNAPPMOB_API_BASE_URL}/api/v2/gold/${provider}`;
    const response = await fetchWithVnappmobToken(env, "gold", requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 150);
      failureDetails.push(`${provider}:http_${response.status}${body ? `:${body}` : ""}`);
      continue;
    }

    const payload = (await response.json()) as VnappmobRetailPayload;
    if (!Array.isArray(payload.results) || payload.results.length === 0) {
      failureDetails.push(`${provider}:missing_results`);
      continue;
    }

    const firstRecord = payload.results[0];
    if (!firstRecord || typeof firstRecord !== "object") {
      failureDetails.push(`${provider}:missing_record`);
      continue;
    }

    const record = firstRecord as Record<string, unknown>;
    const parsedPrice = provider === "sjc" ? parseSjc(record) : parseCityBrand(record, city);
    if (!parsedPrice) {
      failureDetails.push(`${provider}:missing_valid_buy_sell`);
      continue;
    }

    return {
      sourceBrand: provider,
      ...parsedPrice,
      asOf: parseAsOf(record, fetchedAtIso),
    };
  }

  throw new UpstreamServiceError("vnappmob retail request failed for all providers", {
    service: "vnappmob",
    operation: "fetchRetailPrice",
    detail: failureDetails.slice(0, 8).join("; "),
  });
}
