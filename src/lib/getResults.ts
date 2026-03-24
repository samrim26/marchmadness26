import type { Results } from "@/lib/types";
import { RESULTS as STATIC_RESULTS } from "@/data/results";

/**
 * Fetch live results from Vercel KV if configured, otherwise fall back
 * to the static results.ts file (used for local dev / pre-KV setup).
 */
export async function getResults(): Promise<Results> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return { ...STATIC_RESULTS };
  }
  try {
    const { kv } = await import("@vercel/kv");
    const stored = await kv.get<Results>("tournament:results");
    return stored ?? { ...STATIC_RESULTS };
  } catch {
    return { ...STATIC_RESULTS };
  }
}

/**
 * Persist results to Vercel KV.
 * Throws if KV is not configured.
 */
export async function setResults(results: Results): Promise<void> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error("KV not configured — add KV_REST_API_URL and KV_REST_API_TOKEN env vars.");
  }
  const { kv } = await import("@vercel/kv");
  await kv.set("tournament:results", results);
}
