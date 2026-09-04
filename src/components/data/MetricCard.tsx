import { signedTone } from "@/lib/format";

export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral" | "muted";
}) {
  return (
    <div className="metric">
      <div className="k">{label}</div>
      <div className={`v num ${tone ?? "neutral"}`}>{value}</div>
      {hint ? <div className="page-sub">{hint}</div> : null}
    </div>
  );
}

export function SignedMetric({
  label,
  text,
  value,
}: {
  label: string;
  text: string;
  value: number | null | undefined;
}) {
  return <MetricCard label={label} value={text} tone={signedTone(value)} />;
}
