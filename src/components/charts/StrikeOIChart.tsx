"use client";

import { useMemo } from "react";
import type { MultiStrikeRow, OptionStrikeRow } from "@/api/types";
import { EmptyState } from "@/components/data/States";
import { formatCompactIndian, formatInt } from "@/lib/format";

type Side = "ce" | "pe";
type Field = "oi" | "oi_change" | "volume";

function valuesFromStrikes(strikes: OptionStrikeRow[], side: Side, field: Field): { strike: number; value: number | null }[] {
  return strikes.map((row) => ({
    strike: row.strike,
    value: (row[side]?.[field] as number | null | undefined) ?? null,
  }));
}

function valuesFromMulti(rows: MultiStrikeRow[], side: Side, field: Field) {
  const key = `${side}_${field}` as keyof MultiStrikeRow;
  return rows.map((row) => ({
    strike: row.strike,
    value: (row[key] as number | null | undefined) ?? null,
  }));
}

export function StrikeBarChart({
  title,
  rows,
  color = "#7eb6ff",
  signed = false,
  empty = "No strike series",
}: {
  title: string;
  rows: { strike: number; value: number | null }[];
  color?: string;
  signed?: boolean;
  empty?: string;
}) {
  const present = rows.filter((r) => r.value != null);
  const max = useMemo(() => {
    const nums = present.map((r) => Math.abs(r.value as number));
    return nums.length ? Math.max(...nums) : 0;
  }, [present]);
  if (!rows.length) return <EmptyState title={empty} />;
  if (!present.length) {
    return <EmptyState title={empty} detail="Listed strikes have no values for this series." />;
  }
  return (
    <div className="panel">
      <div className="panel-h">
        <span>{title}</span>
        <span>{present.length} strikes</span>
      </div>
      <div className="panel-b" style={{ maxHeight: 280, overflow: "auto" }}>
        {rows.map((row) => {
          const v = row.value;
          const mag = v == null || max === 0 ? 0 : (Math.abs(v) / max) * 100;
          const fill = signed ? (v != null && v < 0 ? "#f07178" : "#3dd68c") : color;
          return (
            <div
              key={row.strike}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr 72px",
                gap: 8,
                alignItems: "center",
                height: 18,
              }}
            >
              <span className="num muted">{formatInt(row.strike)}</span>
              <div style={{ height: 8, background: "#182033" }}>
                <div style={{ width: `${mag}%`, height: "100%", background: fill }} />
              </div>
              <span className="num r" style={{ color: signed && v != null && v < 0 ? "var(--down)" : undefined }}>
                {v == null ? "—" : formatCompactIndian(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StrikeOIChart({
  strikes,
  multi,
  maxPain,
}: {
  strikes?: OptionStrikeRow[] | null;
  multi?: MultiStrikeRow[] | null;
  maxPain?: number | null;
}) {
  const ce = strikes?.length
    ? valuesFromStrikes(strikes, "ce", "oi")
    : valuesFromMulti(multi ?? [], "ce", "oi");
  const pe = strikes?.length
    ? valuesFromStrikes(strikes, "pe", "oi")
    : valuesFromMulti(multi ?? [], "pe", "oi");
  const ceChg = strikes?.length
    ? valuesFromStrikes(strikes, "ce", "oi_change")
    : valuesFromMulti(multi ?? [], "ce", "oi_change");
  const peChg = strikes?.length
    ? valuesFromStrikes(strikes, "pe", "oi_change")
    : valuesFromMulti(multi ?? [], "pe", "oi_change");
  const volCe = strikes?.length
    ? valuesFromStrikes(strikes, "ce", "volume")
    : valuesFromMulti(multi ?? [], "ce", "volume");
  const volPe = strikes?.length
    ? valuesFromStrikes(strikes, "pe", "volume")
    : valuesFromMulti(multi ?? [], "pe", "volume");
  return (
    <div className="stack">
      {maxPain != null ? (
        <div className="page-sub">Max pain marker (backend): {maxPain}</div>
      ) : (
        <div className="page-sub">Max pain unavailable</div>
      )}
      <div className="grid-2">
        <StrikeBarChart title="Call OI by strike" rows={ce} color="#7eb6ff" />
        <StrikeBarChart title="Put OI by strike" rows={pe} color="#c4a35a" />
        <StrikeBarChart title="Call OI change by strike" rows={ceChg} signed />
        <StrikeBarChart title="Put OI change by strike" rows={peChg} signed />
        <StrikeBarChart title="Call volume by strike" rows={volCe} color="#3d5a80" />
        <StrikeBarChart title="Put volume by strike" rows={volPe} color="#5a4a2a" />
      </div>
    </div>
  );
}

export function StrikeVolumeChart({ strikes }: { strikes: OptionStrikeRow[] }) {
  const ce = valuesFromStrikes(strikes, "ce", "volume");
  const pe = valuesFromStrikes(strikes, "pe", "volume");
  return (
    <div className="grid-2">
      <StrikeBarChart title="Call volume" rows={ce} />
      <StrikeBarChart title="Put volume" rows={pe} color="#c4a35a" />
    </div>
  );
}
