# Gold Compare Dashboard (Frontend)

React + TypeScript + Vite frontend for the Gold Compare MVP.

## Purpose

This app renders the dashboard UI for comparing:
- Global spot gold (`USD / troy oz`)
- VN retail gold (`VND / lượng`)
- Computed spot in `VND / lượng`
- Premium/discount of retail vs spot (absolute and %)

The frontend consumes a single backend endpoint (`/api/quote`) provided by the Cloudflare Worker.

## Tech stack

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4 (`@tailwindcss/vite` plugin)
- pnpm

## Prerequisites

- Node.js 20+
- pnpm 10+

This project pins `packageManager` in `package.json` and should be run with `pnpm`.

## Development

From `frontend/`:

```bash
pnpm install
pnpm dev
```

App runs on Vite dev server (default: `http://localhost:5173`).

### Backend integration (Vite proxy)

During local development, frontend `/api/*` requests are proxied by Vite to a backend target.

- Default proxy target: `http://127.0.0.1:8787` (typical `wrangler dev` port)
- Override with env var:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:8787
```

You can place this in `frontend/.env.local` for local-only config.

### Production integration (Cloudflare Pages + Service Binding)

For production on Cloudflare Pages, use Pages Functions with a Service Binding.

- This repo includes `functions/api/[[path]].ts`, which forwards `/api/*` requests to a bound Worker.
- Configure in Pages project settings:
  - `Settings` -> `Bindings` -> `Add binding` -> `Service binding`
  - Variable name: `GOLD_API`
  - Service: `gold-price-service` (or your deployed Worker name)
- Keep frontend API calls as relative paths (for example: `/api/quote?retailBrand=sjc`).

## Scripts

- `pnpm dev`: start local dev server
- `pnpm build`: type-check and production build
- `pnpm preview`: preview built app
- `pnpm lint`: run ESLint

## API contract expectation

Frontend is expected to consume:

- `GET /api/quote?retailBrand=sjc`

Key response sections used by UI:
- `meta` (server time, freshness)
- `spot`
- `fx`
- `computed`
- `retail`
- `comparison`
- `status`

See `docs/REQUIREMENT.md` for full contract and acceptance criteria.

## Project structure

- `src/main.tsx`: React entrypoint
- `src/App.tsx`: main dashboard UI
- `src/index.css`: Tailwind import and base CSS
- `vite.config.ts`: Vite config + Tailwind plugin

## Notes

- Do not put API keys/secrets in frontend code.
- All upstream provider credentials must remain in the Worker environment.
