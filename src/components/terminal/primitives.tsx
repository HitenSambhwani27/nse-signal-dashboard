import type { ReactNode } from "react";
import { signedTone } from "@/lib/format";

export function ToneValue({
  value,
  children,
  className = "",
}: {
  value: number | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const tone = signedTone(value);
  return <span className={`pulse-tone ${tone} ${className}`.trim()}>{children}</span>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "warn" | "accent";
}) {
  return <span className={`pulse-badge ${tone}`}>{children}</span>;
}

export function PanelHead({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="pulse-panel-h">
      <div className="pulse-panel-h-main">
        <span className="pulse-panel-title">{title}</span>
        {meta}
      </div>
      {actions ? <div className="pulse-panel-h-actions">{actions}</div> : null}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="pulse-icon-btn" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}
