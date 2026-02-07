import { useCallback, useEffect, useState } from "react";
import { fetchQuote } from "../services/quote";
import type { QuoteResponse, RetailBrand } from "../types";

interface UseQuoteResult {
  retailBrand: RetailBrand;
  setRetailBrand: (brand: RetailBrand) => void;
  quote: QuoteResponse | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useQuote(initialBrand: RetailBrand = "sjc"): UseQuoteResult {
  const [retailBrand, setRetailBrand] = useState<RetailBrand>(initialBrand);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(
    async (
      brand: RetailBrand,
      options?: { signal?: AbortSignal; initial?: boolean },
    ) => {
      const initial = options?.initial ?? false;
      if (initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      try {
        const nextQuote = await fetchQuote(brand, options?.signal);
        setQuote(nextQuote);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Unable to fetch quote";
        setError(message);
      } finally {
        if (initial) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadQuote(retailBrand, { signal: controller.signal, initial: true });

    return () => {
      controller.abort();
    };
  }, [loadQuote, retailBrand]);

  const refresh = useCallback(async () => {
    await loadQuote(retailBrand);
  }, [loadQuote, retailBrand]);

  return {
    retailBrand,
    setRetailBrand,
    quote,
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
