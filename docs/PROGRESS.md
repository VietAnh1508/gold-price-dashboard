# Progress tracker

This file captures ongoing work derived from `REQUIREMENT.md`. Update the statuses below whenever a task moves forward.

## Epic A – Cloudflare Worker “Gold Compare Service”
- [x] A1: `/api/quote` returns normalized spot + FX + retail + computed data with caching and graceful degradation.
- [x] A2: Fetch spot XAU/USD from gold-api.com and record provider timestamps.
- [ ] A3: Fetch VNAppMob retail gold (SJC first) with bearer auth, normalize buy/sell, and expose `asOf`.
- [ ] A4: Manage VNAppMob Bearer token lifecycle via KV/Durable Object with refresh + retry logic.
- [ ] A5: Fetch USD/VND FX rate (primary VNAppMob, fallback allowed) and flag stale data.
- [ ] A6: Cache upstream calls (spot, retail, FX) per TTL guidance and report `dataFreshnessSeconds`.
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
- Validation note: `pnpm -C worker run typecheck` passes as of February 7, 2026.
- Update this file each sprint slice (e.g., tick boxes, note blockers, add new rows if scope grows).
