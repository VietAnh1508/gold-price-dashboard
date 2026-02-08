import { useCallback, type ChangeEvent } from "react";
import { useQuote } from "./hooks/useQuote";
import type { RetailBrand } from "./types";
import { InfoCard } from "./components/InfoCard";
import {
  formatPct,
  formatTimestamp,
  formatUsd,
  formatVnd,
} from "./utils/format";
import { getFreshnessBadge } from "./utils/freshness";

function App() {
  const {
    retailBrand,
    setRetailBrand,
    quote,
    isLoading,
    isRefreshing,
    error,
    refresh,
  } = useQuote("sjc");

  const onBrandChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setRetailBrand(event.target.value as RetailBrand);
    },
    [setRetailBrand],
  );

  const badge = getFreshnessBadge(quote);
  const effectiveRetailBrand = quote?.retail.brand ?? retailBrand;
  const computedSpotFormula = quote
    ? `Formula: Spot × (${quote.computed.luong_grams} / ${quote.computed.ozt_grams}) × USD/VND × (1 + ${quote.computed.conversion_premium_pct}%)`
    : "Formula: Spot × (37.5 / 31.1034768) × USD/VND × (1 + 3%)";
  const luongGramsLabel = quote?.computed.luong_grams ?? 37.5;
  const oztGramsLabel = quote?.computed.ozt_grams ?? 31.1034768;
  const conversionPremiumLabel = quote?.computed.conversion_premium_pct ?? 3;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-4 bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Spot Gold (USD/oz)">
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {isLoading
              ? "Loading..."
              : formatUsd(quote?.spot.price_usd_ozt ?? null)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="text-xs text-slate-600">
              Updated {quote?.meta.dataFreshnessSeconds ?? "--"}s ago
            </span>
          </div>
        </InfoCard>

        <InfoCard title="USD/VND Rate">
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatVnd(quote?.fx.rate ?? null)}
          </p>
          <p className="mt-4 text-xs text-slate-600">
            Last updated: {formatTimestamp(quote?.meta.serverTime)}
          </p>
        </InfoCard>

        <InfoCard title="Computed Spot (VND/lượng)">
          <p className="mt-2 text-3xl font-bold tracking-tight">
            {formatVnd(quote?.computed.spot_vnd_luong ?? null)}
          </p>
          <p className="mt-2 text-xs text-slate-600">{computedSpotFormula}</p>
          <p className="mt-2 text-xs text-slate-500">
            {luongGramsLabel} = grams/lượng
          </p>
          <p className="text-xs text-slate-500">
            {oztGramsLabel} = grams/troy ounce (ozt)
          </p>
          <p className="text-xs text-slate-500">
            {conversionPremiumLabel}% = spot conversion premium
          </p>
        </InfoCard>
      </section>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard title={`Retail Prices (${effectiveRetailBrand.toUpperCase()})`}>
          <p className="mt-2 text-base text-slate-800">
            Buy: {formatVnd(quote?.retail.buy_vnd_luong ?? null)}
          </p>
          <p className="mt-1 text-base text-slate-800">
            Sell: {formatVnd(quote?.retail.sell_vnd_luong ?? null)}
          </p>
        </InfoCard>

        <InfoCard title="Premium vs Spot">
          <p className="mt-2 text-base text-slate-800">
            Buy premium: {formatVnd(quote?.comparison.premium_buy_vnd ?? null)}{" "}
            ({formatPct(quote?.comparison.premium_buy_pct ?? null)})
          </p>
          <p className="mt-1 text-base text-slate-800">
            Sell premium:{" "}
            {formatVnd(quote?.comparison.premium_sell_vnd ?? null)} (
            {formatPct(quote?.comparison.premium_sell_pct ?? null)})
          </p>
        </InfoCard>
      </section>

      <footer className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isRefreshing || isLoading}
          className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
        <label
          htmlFor="retailBrand"
          className="text-sm font-medium text-slate-700"
        >
          Retail brand
        </label>
        <select
          id="retailBrand"
          value={retailBrand}
          onChange={onBrandChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          <option value="sjc">SJC</option>
          <option value="doji" disabled>
            DOJI (coming soon)
          </option>
          <option value="pnj" disabled>
            PNJ (coming soon)
          </option>
        </select>
      </footer>
    </main>
  );
}

export default App;
