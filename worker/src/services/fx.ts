import type { Env } from "../types/env";
import { VNAPPMOB_API_BASE_URL } from "../utils/constants";
import { fetchWithVnappmobToken } from "./token";
import { parseFiniteNumber, parseIsoTimestamp } from "../utils/parsing";
import { UpstreamServiceError } from "../utils/errors";

export interface FxResult {
  rate: number;
  providerTimestamp: string;
}

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
  const requestUrl = `${VNAPPMOB_API_BASE_URL}${VNAPPMOB_EXCHANGE_RATE_PATH}`;
  const response = await fetchWithVnappmobToken(
    env,
    "exchange_rate",
    requestUrl,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new UpstreamServiceError("vnappmob fx request failed", {
      service: "vnappmob",
      operation: "fetchUsdVndRate",
      url: requestUrl,
      status: response.status,
      detail: body || undefined,
    });
  }

  const payload = (await response.json()) as VnappmobExchangeRatePayload;
  if (!Array.isArray(payload.results) || payload.results.length === 0) {
    throw new UpstreamServiceError("vnappmob fx response missing results", {
      service: "vnappmob",
      operation: "fetchUsdVndRate",
      url: requestUrl,
    });
  }

  const usdRecord = payload.results.find((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return typeof record.currency === "string" && record.currency.toUpperCase() === "USD";
  });

  const firstRecord = usdRecord ?? payload.results[0];
  if (!firstRecord || typeof firstRecord !== "object") {
    throw new UpstreamServiceError("vnappmob fx response missing record", {
      service: "vnappmob",
      operation: "fetchUsdVndRate",
      url: requestUrl,
    });
  }

  const record = firstRecord as Record<string, unknown>;
  const rate = parseUsdVndRate(record);
  if (rate === null) {
    throw new UpstreamServiceError("vnappmob fx response missing valid USD/VND rate", {
      service: "vnappmob",
      operation: "fetchUsdVndRate",
      url: requestUrl,
    });
  }

  return {
    rate,
    providerTimestamp: parseProviderTimestamp(payload, record, fetchedAtIso),
  };
}
