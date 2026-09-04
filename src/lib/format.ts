export const DASH = "—";
export const NA = "N/A";

export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function formatInr(value: number | null | undefined, digits = 2): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatInt(value: number | null | undefined): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return Math.round(value).toLocaleString("en-IN");
}

export function formatPct(value: number | null | undefined, signed = true): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Backend ratio (0.014 → 1.40%). Used for option/futures change fields that are not pre-multiplied. */
export function formatRatioPct(value: number | null | undefined, signed = true): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return formatPct(value * 100, signed);
}

export function formatSigned(value: number | null | undefined, digits = 2): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatCompactIndian(value: number | null | undefined, digits = 2): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(digits)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(digits)}L`;
  return formatInt(value);
}

export function formatOi(value: number | null | undefined): string {
  return formatCompactIndian(value, 2);
}

export function formatVolume(value: number | null | undefined): string {
  return formatCompactIndian(value, 2);
}

export function formatNotional(value: number | null | undefined): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return `₹${formatCompactIndian(value, 2)}`;
}

export function formatQty(value: number | null | undefined): string {
  return formatInt(value);
}

export function formatBasis(value: number | null | undefined): string {
  return formatSigned(value, 2);
}

export function formatPcr(value: number | null | undefined): string {
  if (isNullish(value) || Number.isNaN(value)) return DASH;
  return value.toFixed(3);
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ageSeconds(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, (now - date.getTime()) / 1000);
}

export function formatAge(seconds: number | null | undefined): string {
  if (isNullish(seconds) || Number.isNaN(seconds)) return DASH;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function signedTone(value: number | null | undefined): "up" | "down" | "neutral" {
  if (isNullish(value) || value === 0 || Number.isNaN(value)) return "neutral";
  return value > 0 ? "up" : "down";
}

export function formatInsufficient(days: number | null | undefined, threshold = 60): string {
  const n = days ?? 0;
  return `Insufficient data, ${n}/${threshold} pooled days`;
}
