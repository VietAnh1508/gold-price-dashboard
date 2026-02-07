import { DATETIME_FORMATTER, PCT_FORMATTER, USD_FORMATTER, VND_FORMATTER } from '../constants/formatters'

export function formatUsd(value: number | null): string {
  return value === null ? '--' : USD_FORMATTER.format(value)
}

export function formatVnd(value: number | null): string {
  return value === null ? '--' : `${VND_FORMATTER.format(Math.round(value))} VND`
}

export function formatPct(value: number | null): string {
  return value === null ? '--' : `${PCT_FORMATTER.format(value)}%`
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '--'

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return '--'

  return DATETIME_FORMATTER.format(parsed)
}
