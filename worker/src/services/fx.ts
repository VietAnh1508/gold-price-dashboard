import type { Env } from "../types/env";
import { parseFiniteNumber, parseIsoTimestamp } from "../utils/parsing";

export interface FxResult {
  rate: number;
  providerTimestamp: string;
}

const VNAPPMOB_API_BASE_URL = "https://api.vnappmob.com";
const VNAPPMOB_EXCHANGE_RATE_PATH = "/api/v2/exchange_rate/vcb?currency=USD";

interface VnappmobExchangeRatePayload {
  results?: unknown;
  date?: unknown;
  timestamp?: unknown;
  updated_at?: unknown;
}

function parseProviderTimestamp(
  payload: VnappmobExchangeRatePayload,
  record: Record<string, unknown>,
  fetchedAtIso: string,
): string {
  const candidates = [
    record.asOf,
    record.as_of,
    record.updated_at,
    record.update_at,
    record.timestamp,
    record.date,
    payload.updated_at,
    payload.timestamp,
    payload.date,
  ];

  for (const candidate of candidates) {
    const parsed = parseIsoTimestamp(candidate, "");
    if (parsed) return parsed;
  }

  return fetchedAtIso;
}

function parseUsdVndRate(record: Record<string, unknown>): number | null {
  // Use the most end-user-relevant retail conversion first, then fall back.
  const candidates = [record.sell, record.buy_transfer, record.buy_cash, record.buy, record.rate];
  for (const candidate of candidates) {
    const parsed = parseFiniteNumber(candidate);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

export async function fetchUsdVndRate(env: Env): Promise<FxResult> {
  const fetchedAtIso = new Date().toISOString();
  const response = await fetch(`${VNAPPMOB_API_BASE_URL}${VNAPPMOB_EXCHANGE_RATE_PATH}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.VNAPPMOB_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`vnappmob fx request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as VnappmobExchangeRatePayload;
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    throw new Error("vnappmob fx response missing results");
  }

  const usdRecord = payload.results.find((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return typeof record.currency === "string" && record.currency.toUpperCase() === "USD";
  });

  const firstRecord = usdRecord ?? payload.results[0];
  if (!firstRecord || typeof firstRecord !== "object") {
    throw new Error("vnappmob fx response missing record");
  }

  const record = firstRecord as Record<string, unknown>;
  const rate = parseUsdVndRate(record);
  if (rate === null) {
    throw new Error("vnappmob fx response missing valid USD/VND rate");
  }

  return {
    rate,
    providerTimestamp: parseProviderTimestamp(payload, record, fetchedAtIso),
  };
}
