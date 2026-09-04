import { ageSeconds } from "@/lib/format";

export type FreshnessLevel = "fresh" | "aging" | "stale" | "missing";

export interface Freshness {
  level: FreshnessLevel;
  ageSeconds: number | null;
  label: string;
}

export function classifyFreshness(
  asOf: string | null | undefined,
  now = Date.now(),
  opts?: { freshWithin?: number; agingWithin?: number },
): Freshness {
  const freshWithin = opts?.freshWithin ?? 15;
  const agingWithin = opts?.agingWithin ?? 300;
  const age = ageSeconds(asOf, now);
  if (age == null) {
    return { level: "missing", ageSeconds: null, label: "No timestamp" };
  }
  if (age <= freshWithin) {
    return { level: "fresh", ageSeconds: age, label: "Receiving data" };
  }
  if (age <= agingWithin) {
    return { level: "aging", ageSeconds: age, label: "Aging" };
  }
  return { level: "stale", ageSeconds: age, label: "Data is stale" };
}

export function sessionHoursIst(now = new Date()): {
  inSession: boolean;
  weekday: boolean;
  label: string;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const mins = hour * 60 + minute;
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  const inSession = isWeekday && mins >= open && mins <= close;
  return {
    inSession,
    weekday: isWeekday,
    label: inSession ? "Session hours" : "Market closed",
  };
}

export type MarketStatusKind =
  | "market_closed"
  | "awaiting"
  | "no_live_data"
  | "receiving"
  | "stale";

export function marketStatus(opts: {
  asOf?: string | null;
  lastIngest?: string | null;
  found?: boolean | null;
  now?: Date;
}): { kind: MarketStatusKind; label: string } {
  const session = sessionHoursIst(opts.now ?? new Date());
  const freshness = classifyFreshness(opts.asOf ?? opts.lastIngest ?? null, (opts.now ?? new Date()).getTime());
  if (!session.inSession) {
    return { kind: "market_closed", label: "Market closed" };
  }
  if (opts.found === false || freshness.level === "missing") {
    return { kind: "awaiting", label: "Awaiting market data" };
  }
  if (freshness.level === "stale") {
    return { kind: "stale", label: "No live data" };
  }
  if (freshness.level === "fresh" || freshness.level === "aging") {
    return { kind: "receiving", label: "Receiving data" };
  }
  return { kind: "awaiting", label: "Awaiting market data" };
}
