import type { ReactNode } from "react";
import { formatAge, formatTimestamp } from "@/lib/format";
import { classifyFreshness, type FreshnessLevel } from "@/lib/freshness";

export function DataFreshnessBadge({
  asOf,
  stale,
}: {
  asOf?: string | null;
  stale?: boolean;
}) {
  const freshness = classifyFreshness(asOf);
  const level: FreshnessLevel = stale ? "stale" : freshness.level;
  const label =
    level === "stale"
      ? "Data is stale"
      : level === "missing"
        ? "No timestamp"
        : level === "aging"
          ? `Aging ${formatAge(freshness.ageSeconds)}`
          : `As of ${formatAge(freshness.ageSeconds)}`;
  return (
    <span className={`badge ${level}`} title={formatTimestamp(asOf)}>
      <span className={`dot ${level}`} />
      {label}
    </span>
  );
}

export function AsOfLabel({ value }: { value?: string | null }) {
  return <span className="num muted">{formatTimestamp(value)}</span>;
}

export function StatusBadge({
  tone = "muted",
  children,
}: {
  tone?: string;
  children: ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function ChainStatusBadge({
  status,
  truncated,
}: {
  status?: string | null;
  truncated?: boolean | null;
}) {
  if (truncated || status === "truncated") {
    return <span className="badge warning">Partial chain — subscription limit</span>;
  }
  if (status === "partial") {
    return <span className="badge warning">Partial option chain</span>;
  }
  if (status === "empty") {
    return <span className="badge muted">Empty chain</span>;
  }
  if (status === "complete") {
    return <span className="badge fresh">Chain complete</span>;
  }
  if (!status) return <span className="badge muted">Chain N/A</span>;
  return <span className="badge muted">{status}</span>;
}

export function BasisStatusBadge({ status }: { status?: string | null }) {
  if (status === "fresh") return <span className="badge fresh">Basis fresh</span>;
  if (status === "stale") return <span className="badge stale">Basis stale</span>;
  if (status === "missing") return <span className="badge muted">Basis missing</span>;
  return <span className="badge muted">Basis N/A</span>;
}

export function SeverityBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="badge muted">—</span>;
  const tone =
    level === "high" ? "down" : level === "elevated" || level === "watch" ? "warning" : "muted";
  return <span className={`badge ${tone}`}>{level}</span>;
}
