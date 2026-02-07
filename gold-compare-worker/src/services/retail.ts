import type { Env } from "../types/env";

export interface RetailResult {
  buyVndLuong: number;
  sellVndLuong: number;
  asOf: string;
}

export async function fetchRetailPrice(
  _env: Env,
  _brand: "sjc" | "doji" | "pnj",
  _city?: string,
): Promise<RetailResult> {
  throw new Error("Not implemented: A3 retail provider integration");
}
