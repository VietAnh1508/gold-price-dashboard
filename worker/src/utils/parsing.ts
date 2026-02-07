export function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function parseIsoTimestamp(rawTimestamp: unknown, fallbackIso: string): string {
  if (typeof rawTimestamp === "string") {
    const ms = Date.parse(rawTimestamp);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }

  if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    const ms = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
    return new Date(ms).toISOString();
  }

  return fallbackIso;
}
