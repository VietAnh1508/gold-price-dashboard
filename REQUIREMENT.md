## Product goal

As a user, I want a lightweight dashboard that shows:
1. Global spot gold price (USD / troy oz)
2. Vietnam retail gold price (VND / lượng) (e.g., SJC buy/sell)
3. Computed spot gold price converted to VND / lượng
4. The premium/discount of VN retail vs global spot (absolute + %)

So I can quickly compare global spot vs local VN retail whenever I open the page (2–3 times/day).

---

## Key assumptions and definitions

- “Spot USD/oz” comes from gold-api.com “real time price API” (free, no auth, no rate limiting, CORS enabled).
- VN retail comes from VNAppMob Gold Price API v2, which uses a Bearer token and returns buy/sell values (e.g., SJC buy_1l, sell_1l).
- Conversion formula:

```text
spot_vnd_luong = spot_usd_ozt × (37.5 / 31.1034768) × usd_vnd
```

- FX source (USD→VND):
  - Primary: VNAppMob exchange rate API v2 (also Bearer auth).
  - Fallback: any public FX API (optional, if VNAppMob FX is unavailable).

---

### EPIC A — Cloudflare Worker “Gold Compare Service”

#### A1. User story: Provide one normalized “quote” endpoint

As a frontend, I want a single endpoint that returns spot + VN retail + computed conversion, so the UI can render everything with one request.

**API Endpoint**

`GET /api/quote?retailBrand=doji&retailCity=hcm`

- `retailBrand`: `sjc` | `doji` | `pnj` (start with `doji` as default)
- `retailCity`: optional (only if the source differentiates by location; if not, ignore)

**Response JSON (contract)**

```json
{
  "meta": {
    "serverTime": "2026-02-07T07:00:00+07:00",
    "cacheTtlSeconds": 120,
    "dataFreshnessSeconds": 45
  },
  "spot": {
    "provider": "gold-api.com",
    "symbol": "XAU",
    "currency": "USD",
    "price_usd_ozt": 2035.12,
    "providerTimestamp": "2026-02-07T06:59:30Z"
  },
  "fx": {
    "provider": "vnappmob",
    "pair": "USD/VND",
    "rate": 24650.0,
    "providerTimestamp": "2026-02-07T00:00:00Z"
  },
  "computed": {
    "luong_grams": 37.5,
    "ozt_grams": 31.1034768,
    "spot_vnd_luong": 60650000.12
  },
  "retail": {
    "provider": "vnappmob",
    "brand": "sjc",
    "buy_vnd_luong": 76800000.0,
    "sell_vnd_luong": 78300000.0,
    "asOf": "2026-02-07T06:30:00+07:00"
  },
  "comparison": {
    "premium_buy_vnd": 16149999.88,
    "premium_buy_pct": 26.63,
    "premium_sell_vnd": 17649999.88,
    "premium_sell_pct": 29.11
  },
  "status": {
    "spot": "ok",
    "fx": "ok",
    "retail": "ok"
  }
}
```

**Acceptance criteria**

- One call returns everything needed to render the dashboard.
- If one upstream fails:
  - Return last cached value (if available) and mark `status.<source>` as `stale` or `error`.
- Still respond `200` with partial data unless all critical pieces are missing.

---

#### A2. User story: Fetch spot gold from gold-api.com

As the backend, I want to fetch spot XAU/USD quickly and reliably without managing keys.

**Notes**

- gold-api.com advertises no-auth free endpoints, “real time prices stored in memory,” no rate limiting, and CORS enabled.

**Acceptance criteria**

- Worker fetches the current spot price (USD/oz) and returns it in `spot.price_usd_ozt`.
- Worker records provider timestamp if available; otherwise store Worker fetch time as `providerTimestamp`.

---

#### A3. User story: Fetch VN retail gold price from VNAppMob v2

As the backend, I want to fetch SJC (and later DOJI/PNJ) retail buy/sell in VND/lượng.

**Notes**

- VNAppMob Gold API v2 requires `Authorization: Bearer <api_key>` and returns SJC buy/sell fields like `buy_1l`, `sell_1l`.

**Acceptance criteria**

- Worker supports `retailBrand=sjc` and parses buy/sell correctly.
- Maps provider fields to normalized output:
  - `buy_vnd_luong`, `sell_vnd_luong`
- Exposes an `asOf` timestamp if present, else uses fetch time.

---

#### A4. User story: Manage VNAppMob API key lifecycle

As the backend, I want the Worker to obtain and rotate VNAppMob Bearer token automatically so the system doesn’t break when tokens expire.

**Implementation plan**

- Use Cloudflare KV (or Durable Object) to store:
  - `VNAPP_TOKEN`
  - `VNAPP_TOKEN_EXPIRES_AT` (if provided; otherwise set a conservative expiry)
- Token refresh strategy:
  - On every request, if token is missing or expired → request new token.
  - If retail call returns `403 Invalid api_key`, refresh token and retry once.

**Acceptance criteria**

- The system can run unattended without manual token updates.
- Token refresh does not block user requests longer than a single retry.

---

#### A5. User story: Fetch USD/VND FX rate

As the backend, I want to fetch USD/VND so computed VND/lượng is accurate.

**Notes**

- VNAppMob exchange rate v2 supports bearer auth and optional currency filtering.

**Acceptance criteria**

- Worker returns `fx.rate` as a number.
- If FX is stale or unavailable:
  - Use last cached FX.
  - Mark `status.fx = "stale"` and include freshness metadata.

---

#### A6. User story: Cache and rate-limit upstream calls

As the backend, I want caching so we don’t hammer upstream APIs and page refresh is fast.

**Caching rules**

- Cache the final normalized quote response:
  - In-memory cache (per Worker instance) + Cloudflare Cache API.
- Suggested TTL:
  - 120 seconds for spot & retail.
  - 6–24 hours for FX (depending on preference).
- Include `meta.dataFreshnessSeconds` (`now - providerTimestamp`) so UI can display “as of”.

**Acceptance criteria**

- Refreshing the page repeatedly within TTL does not trigger new upstream calls.
- Latency remains low (responses typically served from cache).

---

#### A7. User story: Observability and debugging

As the developer, I want logs and health endpoints to diagnose issues.

**Endpoints**

- `GET /api/health` → `{ ok: true, version, upstreamStatus }`
- `GET /api/debug` (protected by a secret header) → returns last fetch times, cache hit/miss counters.

**Acceptance criteria**

- When a provider breaks, logs identify which upstream failed and why.
- Health endpoint always responds quickly.

---

### EPIC B — React “Gold Compare Dashboard”

#### B1. User story: View current prices with clear comparison

As a user, I want to open the dashboard and immediately see:
- Spot Gold (USD/oz): big number
- USD/VND rate: small label
- Last updated: timestamp + “fresh/stale” badge
- Computed Spot (VND/lượng): big number
- Retail (SJC):
  - Buy
  - Sell
- Premium vs spot:
  - Buy premium (VND + %)
  - Sell premium (VND + %)

**UI layout (simple, functional)**

**Top section:**
- Spot Gold (USD/oz): big number
- USD/VND rate: small label
- Last updated: timestamp + “fresh/stale” badge

**Middle section:**
- Computed Spot (VND/lượng): big number
- Retail (SJC):
  - Buy
  - Sell
- Premium vs spot:
  - Buy premium (VND + %)
  - Sell premium (VND + %)

**Bottom section:**
- “Refresh” button
- Retail brand selector: SJC / DOJI / PNJ (only enable implemented brands)

**Acceptance criteria**

- First load triggers one call to `/api/quote`.
- Numbers are formatted correctly:
  - USD with two decimals.
  - VND with thousand separators and no decimals (or configurable).

---

#### B2. User story: Manual refresh and auto-refresh (optional)

As a user, I want a refresh button; optionally, I want auto-refresh every N minutes.

**Acceptance criteria**

- Refresh triggers a new fetch; if Worker uses caching, it may return cached values but should update `meta.serverTime`.
- Auto-refresh is off by default; user can toggle it (e.g., 5 minutes).

---

#### B3. User story: Show data freshness and partial failures

As a user, I want to know if the displayed numbers are stale.

**UI behavior**

- If `status.retail = "stale"`: show a warning badge next to retail price and continue rendering last known retail values.
- If `status.spot = "error"`: show an error state; retail can still show, but disable premium calculation unless computed exists.
- Display `meta.dataFreshnessSeconds` as “Updated Xs ago”.

**Acceptance criteria**

- UI never crashes on partial data.
- Premium values are hidden or marked “N/A” if computation inputs are missing.

---

#### B4. User story: Configuration panel for “custom values” (MVP-lite)

As a user, I want to optionally override assumptions to see “what-if” comparisons without calling APIs again.

**UI controls**

- Override USD/VND (default = API rate).
- Override lượng grams (default = 37.5).
- Toggle: compute using retail buy vs retail sell reference.

**Acceptance criteria**

- Overrides recalculate computed/premium instantly client-side.
- “Reset to live values” restores API-provided FX and constants.

---

### Non-functional requirements

**Security**

- VNAppMob token and any secrets stored only in Worker env/KV (never shipped to client).
- CORS:
  - Allow your dashboard domain.
  - Deny `*` in production unless you truly want a public API.

**Performance**

- Target: dashboard loads in < 1 second on repeat visits due to Worker caching.

**Deployment**

- Worker: Cloudflare Workers + KV.
- React: Cloudflare Pages (or any static host).
- Environments: dev and prod with separate KV namespaces and secrets.

---

## Definition of Done (MVP)

- **Worker**:
  - `/api/quote`, `/api/health`.
  - Spot + FX + SJC retail + computed + premium.
  - Caching + graceful partial failure.
- **React**:
  - Renders four core numbers + premium.
  - Refresh button.
  - Freshness indicators.
- **Basic monitoring**:
  - Logs on upstream failures.
  - Health endpoint returns provider statuses.
