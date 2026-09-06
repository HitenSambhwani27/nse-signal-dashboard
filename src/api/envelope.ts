import type { Envelope, MaturityMap, MaturityView } from "@/api/types";

export class EnvelopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvelopeError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEnvelope<T extends object>(payload: unknown): Envelope & T {
  if (!isRecord(payload)) {
    throw new EnvelopeError("API response is not an object");
  }
  if (!("maturity" in payload) || payload.maturity === undefined) {
    throw new EnvelopeError("API response missing frozen maturity envelope");
  }
  const maturity = payload.maturity;
  if (!isRecord(maturity)) {
    throw new EnvelopeError("maturity envelope is not an object");
  }
  return payload as Envelope & T;
}

export function maturityViews(maturity: MaturityMap | null | undefined): MaturityView[] {
  if (!maturity) return [];
  const order = ["equity", "futures", "options_nifty", "options_banknifty"];
  const seen = new Set<string>();
  const out: MaturityView[] = [];
  for (const key of order) {
    const view = maturity[key];
    if (view) {
      out.push({ ...view, class_key: view.class_key ?? key, envelope_key: key });
      seen.add(key);
    }
  }
  for (const [key, view] of Object.entries(maturity)) {
    if (!seen.has(key) && view) {
      out.push({ ...view, class_key: view.class_key ?? key, envelope_key: key });
    }
  }
  return out;
}

export function probabilityCell(signal: {
  probability?: number | null;
  probability_permitted?: boolean | null;
  display?: string | null;
}): string {
  if (!signal.probability_permitted) {
    return signal.display || "insufficient data";
  }
  if (signal.probability == null) {
    return signal.display || "insufficient data";
  }
  return signal.probability.toFixed(3);
}

export function assertNoFabricatedProbability(maturity: MaturityMap): void {
  for (const view of Object.values(maturity)) {
    if (!view || typeof view !== "object") continue;
    if (view.probability_permitted) continue;
    if (view.probability != null) {
      throw new Error("suppressed/provisional maturity carried a probability");
    }
  }
}

export function chainStatusLabel(status: string | null | undefined, truncated?: boolean | null): string {
  if (truncated || status === "truncated") return "Partial chain — subscription limit";
  if (status === "partial") return "Partial option chain";
  if (status === "empty") return "Empty chain";
  if (status === "complete") return "Complete";
  if (!status) return "N/A";
  return status;
}

export function preserveNull<T>(value: T | null | undefined): T | null {
  return value === undefined || value === null ? null : value;
}
