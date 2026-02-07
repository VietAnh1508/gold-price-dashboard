# Progress tracker

This file captures ongoing work derived from `REQUIREMENT.md`. Update the statuses below whenever a task moves forward.

## Epic A – Cloudflare Worker “Gold Compare Service”
- [x] A1: `/api/quote` returns normalized spot + FX + retail + computed data with caching and graceful degradation.
- [x] A2: Fetch spot XAU/USD from gold-api.com and record provider timestamps.
- [x] A3: Fetch VNAppMob retail gold (SJC first) with bearer auth, normalize buy/sell, and expose `asOf`.
- [x] A4: Manage VNAppMob Bearer token lifecycle via KV/Durable Object with refresh + retry logic.
- [x] A5: Fetch USD/VND FX rate (primary VNAppMob, fallback allowed) and flag stale data.
- [x] A6: Cache upstream calls (spot, retail, FX) per TTL guidance and report `dataFreshnessSeconds`.
- [ ] A7: Instrument logging plus `/api/health` and `/api/debug` endpoints for observability.

## Epic B – React “Gold Compare Dashboard”
- [ ] B1: Show spot, FX, computed, retail buy/sell, and premium with freshness indicators and formatting.
- [ ] B2: Implement manual refresh button (auto-refresh optional toggle).
- [ ] B3: Surface stale/error states per provider and handle partial data without crashing.
- [ ] B4: Add configuration panel for overriding USD/VND, lượng grams, and retail reference.

## Non-functional requirements & DoD
- [ ] Security: keep VNAppMob secrets in worker env/KV, enforce sane CORS.
- [ ] Performance: target sub-second repeat load via caching.
- [ ] Deployment: Cloudflare Workers + KV for backend, React on Cloudflare Pages (dev/prod splits).
- [ ] Definition of Done: worker endpoints, core UI numbers/premium/refresh/freshness, monitoring/logging.

## Notes
- Last reviewed: February 7, 2026.
- February 7, 2026: A1 implemented in `worker/src/routes/quote.ts` (normalized contract, in-memory quote caching, per-source stale fallback, computed comparison fields, partial-data `200`, all-critical-missing `503`).
- February 7, 2026: A2 implemented in `worker/src/services/spot.ts` (`gold-api.com` XAU spot fetch, strict price parsing, provider timestamp normalization, and fallback to Worker fetch time).
- February 7, 2026: A3 implemented in `worker/src/services/retail.ts` (VNAppMob v2 bearer-auth integration at `/api/v2/gold/{brand}`, SJC `buy_1l`/`sell_1l` normalization, city-aware parsing for non-SJC brands, and `asOf` extraction with fetch-time fallback).
- February 7, 2026: A4 implemented via `worker/src/services/token.ts` (auto token acquisition from VNAppMob `request_api_key` endpoint, KV + in-memory token caching with expiry tracking, and forced refresh on `403 Invalid api_key` with a single retry). `worker/src/services/fx.ts` and `worker/src/services/retail.ts` now use the token manager instead of static bearer secrets.
- February 7, 2026: A5 implemented in `worker/src/services/fx.ts` (VNAppMob v2 exchange-rate integration via bearer auth, USD record selection from `results`, robust `sell`/`buy_transfer`/`buy_cash`/`buy` rate parsing, and provider timestamp normalization with fetch-time fallback). `quote` already marks `status.fx` as `stale` when cached fallback is used.
- February 7, 2026: A5 reliability update in `worker/src/services/fx.ts` adds provider fallback order (`vcb` -> `tcb` -> `ctg` -> `bid` -> `stb` -> `sbv`) so missing VCB values no longer fail FX immediately; the service now returns the first valid USD/VND rate and aggregates failure context when all providers fail.
- February 7, 2026: A5 UX update adds friendly FX provider names (for example `vcb` -> `Vietcombank`, `tcb` -> `Techcombank`) to `FxResult` and `/api/quote` as `fx.providerName` for direct UI rendering.
- February 7, 2026: A6 implemented in `worker/src/routes/quote.ts` (final normalized quote cache via in-memory + Cloudflare Cache API, source-level upstream throttling with short TTL for spot/retail and configurable long TTL for FX via `FX_CACHE_TTL_SECONDS`, and `meta.dataFreshnessSeconds` recalculation on cached responses).
- Validation note: `pnpm -C worker run typecheck` passes as of February 7, 2026.
- Update this file each sprint slice (e.g., tick boxes, note blockers, add new rows if scope grows).
