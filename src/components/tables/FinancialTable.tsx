"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DASH } from "@/lib/format";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  sortValue?: (row: T) => number | string | null;
  render: (row: T) => ReactNode;
}

function cmp(a: number | string | null, b: number | string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export function FinancialTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  empty = "No rows",
  compact,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: string;
  compact?: boolean;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const res = cmp(col.sortValue!(a), col.sortValue!(b));
      return dir === "asc" ? res : -res;
    });
    return copy;
  }, [rows, columns, sortKey, dir]);

  if (!rows.length) {
    return (
      <div className="state">
        <h3>{empty}</h3>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="fin" style={compact ? { fontSize: 11.5 } : undefined}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.align === "right" ? "r" : col.align === "center" ? "c" : undefined}
                style={{ width: col.width, cursor: col.sortValue ? "pointer" : undefined }}
                onClick={() => {
                  if (!col.sortValue) return;
                  if (sortKey === col.key) setDir((d) => (d === "asc" ? "desc" : "asc"));
                  else {
                    setSortKey(col.key);
                    setDir("desc");
                  }
                }}
              >
                {col.header}
                {sortKey === col.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={onRowClick ? "clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.align === "right" ? "r" : col.align === "center" ? "c" : undefined}
                >
                  {col.render(row) ?? <span className="null">{DASH}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NullCell() {
  return <span className="null">{DASH}</span>;
}
