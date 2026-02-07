import type { Env } from "../types/env";
import { VNAPPMOB_API_BASE_URL } from "../utils/constants";
import { fetchWithVnappmobToken } from "./token";
import { parseFiniteNumber, parseIsoTimestamp } from "../utils/parsing";
import { UpstreamServiceError } from "../utils/errors";

export interface FxResult {
  provider: FxProviderCode;
  providerName: string;
  rate: number;
  providerTimestamp: string;
}

const FX_PROVIDER_PRIORITY = ["vcb", "tcb", "ctg", "bid", "stb", "sbv"] as const;
type FxProviderCode = (typeof FX_PROVIDER_PRIORITY)[number];
const FX_PROVIDER_NAMES: Record<FxProviderCode, string> = {
  vcb: "Vietcombank",
  tcb: "Techcombank",
  ctg: "VietinBank",
  bid: "BIDV",
  stb: "Sacombank",
  sbv: "State Bank of Vietnam",
};

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
  const failureDetails: string[] = [];

  for (const provider of FX_PROVIDER_PRIORITY) {
    const requestUrl = `${VNAPPMOB_API_BASE_URL}/api/v2/exchange_rate/${provider}?currency=USD`;
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
      const body = (await response.text()).slice(0, 150);
      failureDetails.push(`${provider}:http_${response.status}${body ? `:${body}` : ""}`);
      continue;
    }

    const payload = (await response.json()) as VnappmobExchangeRatePayload;
    if (!Array.isArray(payload.results) || payload.results.length === 0) {
      failureDetails.push(`${provider}:missing_results`);
      continue;
    }

    const usdRecord = payload.results.find((row) => {
      if (!row || typeof row !== "object") return false;
      const record = row as Record<string, unknown>;
      return typeof record.currency === "string" && record.currency.toUpperCase() === "USD";
    });

    const firstRecord = usdRecord ?? payload.results[0];
    if (!firstRecord || typeof firstRecord !== "object") {
      failureDetails.push(`${provider}:missing_record`);
      continue;
    }

    const record = firstRecord as Record<string, unknown>;
    const rate = parseUsdVndRate(record);
    if (rate === null) {
      failureDetails.push(`${provider}:missing_valid_rate`);
      continue;
    }

    return {
      provider,
      providerName: FX_PROVIDER_NAMES[provider],
      rate,
      providerTimestamp: parseProviderTimestamp(payload, record, fetchedAtIso),
    };
  }

  throw new UpstreamServiceError("vnappmob fx request failed for all providers", {
    service: "vnappmob",
    operation: "fetchUsdVndRate",
    detail: failureDetails.slice(0, 8).join("; "),
  });
}
