import type { Env } from "../types/env";
import { VNAPPMOB_API_BASE_URL } from "../utils/constants";
import { UpstreamServiceError } from "../utils/errors";

export type VnappmobScope = "gold" | "exchange_rate";

const KV_KEY_PREFIX = "VNAPPMOB_TOKEN";
const EXPIRY_SKEW_SECONDS = 60;
const CONSERVATIVE_TTL_SECONDS = 60 * 60 * 12;

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenMemoryCache = new Map<VnappmobScope, TokenCacheEntry>();

interface GetTokenOptions {
  forceRefresh?: boolean;
}

function kvTokenKey(scope: VnappmobScope): string {
  return `${KV_KEY_PREFIX}:${scope}`;
}

function kvExpiryKey(scope: VnappmobScope): string {
  return `${KV_KEY_PREFIX}:${scope}:EXPIRES_AT`;
}

function hasTokenExpired(expiresAtMs: number, nowMs: number): boolean {
  return expiresAtMs <= nowMs + EXPIRY_SKEW_SECONDS * 1000;
}

function decodeJwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payloadBase64Url = parts[1];
    const payloadBase64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const payloadJson = atob(padded);
    const payload = JSON.parse(payloadJson) as { exp?: unknown };

    if (typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp > 0) {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }

  return null;
}

function deriveTokenExpiryMs(token: string, nowMs: number): number {
  const fromJwt = decodeJwtExpiryMs(token);
  if (fromJwt !== null) {
    return fromJwt;
  }
  return nowMs + CONSERVATIVE_TTL_SECONDS * 1000;
}

function buildAuthHeaders(token: string, headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  merged.set("Authorization", `Bearer ${token}`);
  return merged;
}

function isInvalidApiKeyResponse(response: Response, bodyText: string): boolean {
  return response.status === 403 && /invalid[\s_-]*api[\s_-]*key/i.test(bodyText);
}

async function requestNewToken(scope: VnappmobScope): Promise<string> {
  const requestUrl = `${VNAPPMOB_API_BASE_URL}/api/request_api_key?scope=${scope}`;
  const response = await fetch(requestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new UpstreamServiceError("vnappmob token request failed", {
      service: "vnappmob",
      operation: "requestNewToken",
      url: requestUrl,
      status: response.status,
      detail: body || undefined,
    });
  }

  const payload = (await response.json()) as { results?: unknown };
  if (typeof payload.results !== "string" || payload.results.trim().length === 0) {
    throw new UpstreamServiceError("vnappmob token response missing token", {
      service: "vnappmob",
      operation: "requestNewToken",
      url: requestUrl,
    });
  }

  return payload.results.trim();
}

export async function getValidVnappmobToken(
  env: Env,
  scope: VnappmobScope,
  options: GetTokenOptions = {},
): Promise<string> {
  const forceRefresh = options.forceRefresh === true;
  const nowMs = Date.now();
  const cached = tokenMemoryCache.get(scope);

  if (!forceRefresh && cached && !hasTokenExpired(cached.expiresAt, nowMs)) {
    return cached.token;
  }

  if (!forceRefresh) {
    const [kvToken, kvExpiresAtRaw] = await Promise.all([
      env.TOKENS_KV.get(kvTokenKey(scope)),
      env.TOKENS_KV.get(kvExpiryKey(scope)),
    ]);

    const kvExpiresAt = kvExpiresAtRaw ? Number.parseInt(kvExpiresAtRaw, 10) : NaN;
    if (kvToken && Number.isFinite(kvExpiresAt) && !hasTokenExpired(kvExpiresAt, nowMs)) {
      tokenMemoryCache.set(scope, { token: kvToken, expiresAt: kvExpiresAt });
      return kvToken;
    }
  }

  const token = await requestNewToken(scope);
  const expiresAt = deriveTokenExpiryMs(token, nowMs);
  tokenMemoryCache.set(scope, { token, expiresAt });

  await Promise.all([
    env.TOKENS_KV.put(kvTokenKey(scope), token),
    env.TOKENS_KV.put(kvExpiryKey(scope), String(expiresAt)),
  ]);

  return token;
}

export async function fetchWithVnappmobToken(
  env: Env,
  scope: VnappmobScope,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const execute = async (forceRefresh: boolean): Promise<Response> => {
    const token = await getValidVnappmobToken(env, scope, { forceRefresh });
    const headers = buildAuthHeaders(token, init.headers);
    return fetch(input, { ...init, headers });
  };

  const firstResponse = await execute(false);
  if (firstResponse.status !== 403) {
    return firstResponse;
  }

  const firstBody = await firstResponse.clone().text();
  if (!isInvalidApiKeyResponse(firstResponse, firstBody)) {
    return firstResponse;
  }

  return execute(true);
}
