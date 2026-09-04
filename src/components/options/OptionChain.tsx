"use client";

import { useMemo, useState } from "react";
import type { OptionChain, OptionSide, OptionStrikeRow } from "@/api/types";
import { DASH, formatCompactIndian, formatInr, formatInt, formatRatioPct, formatSigned } from "@/lib/format";
import { NullCell } from "@/components/tables/FinancialTable";

function cell(value: string, className?: string) {
  return <span className={className}>{value}</span>;
}

function numCell(text: string, raw: number | null | undefined) {
  const cls =
    raw == null ? "null" : raw > 0 ? "num up" : raw < 0 ? "num down" : "num";
  return cell(text, cls);
}

function ivCell(side: OptionSide | null) {
  if (!side || side.iv == null) return <span className="null">N/A</span>;
  return cell(side.iv.toFixed(2));
}

function SideCells({
  side,
  mirror,
}: {
  side: OptionSide | null;
  mirror?: boolean;
}) {
  const oi = side ? formatCompactIndian(side.oi) : DASH;
  const oiChg = side ? formatSigned(side.oi_change, 0) : DASH;
  const vol = side ? formatCompactIndian(side.volume) : DASH;
  const px = side ? formatInr(side.ltp) : DASH;
  const bid = side ? formatInr(side.best_bid) : DASH;
  const ask = side ? formatInr(side.best_ask) : DASH;
  const oiChgPct = side ? formatRatioPct(side.oi_change_pct, true) : DASH;
  const callOrder = [
    numCell(oi, side?.oi ?? null),
    numCell(oiChg, side?.oi_change ?? null),
    cell(oiChgPct, "num muted"),
    cell(vol, side?.volume == null ? "null" : "num"),
    ivCell(side),
    cell(px, side?.ltp == null ? "null" : "num"),
    cell(bid, side?.best_bid == null ? "null" : "num"),
    cell(ask, side?.best_ask == null ? "null" : "num"),
  ];
  const putOrder = [
    cell(bid, side?.best_bid == null ? "null" : "num"),
    cell(ask, side?.best_ask == null ? "null" : "num"),
    cell(px, side?.ltp == null ? "null" : "num"),
    ivCell(side),
    cell(vol, side?.volume == null ? "null" : "num"),
    cell(oiChgPct, "num muted"),
    numCell(oiChg, side?.oi_change ?? null),
    numCell(oi, side?.oi ?? null),
  ];
  const ordered = mirror ? putOrder : callOrder;
  return (
    <>
      {ordered.map((n, i) => (
        <td key={i} className="r">
          {n}
        </td>
      ))}
    </>
  );
}

export function OptionChainTable({ chain }: { chain: OptionChain }) {
  const [range, setRange] = useState<number | "all">(10);
  const [hover, setHover] = useState<number | null>(null);
  const filtered = useMemo(() => {
    const listed = chain.strikes ?? [];
    if (range === "all" || chain.atm == null) return listed;
    return listed.filter((row) => {
      if (row.distance_from_atm == null) return true;
      return Math.abs(row.distance_from_atm) <= range;
    });
  }, [chain.strikes, range, chain.atm]);
  const strikes = chain.strikes ?? [];

  if (!strikes.length) {
    return (
      <div className="state">
        <h3>No option strikes</h3>
        <p>Backend returned an empty chain for this expiry.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="page-sub">Strike range</span>
        {[5, 10, 20].map((n) => (
          <button
            key={n}
            className={`btn ${range === n ? "active" : ""}`}
            onClick={() => setRange(n)}
          >
            ATM±{n}
          </button>
        ))}
        <button className={`btn ${range === "all" ? "active" : ""}`} onClick={() => setRange("all")}>
          All {strikes.length}
        </button>
        <span className="page-sub">{filtered.length} rows shown</span>
      </div>
      <div className="chain-wrap">
        <table className="chain">
          <thead>
            <tr>
              <th colSpan={8} className="c">
                Calls
              </th>
              <th className="strike-col">Strike</th>
              <th colSpan={8} className="c">
                Puts
              </th>
            </tr>
            <tr>
              <th className="r">OI</th>
              <th className="r">OI chg</th>
              <th className="r">OI chg%</th>
              <th className="r">Vol</th>
              <th className="r">IV</th>
              <th className="r">Price</th>
              <th className="r">Bid</th>
              <th className="r">Ask</th>
              <th className="strike-col">CE | PE</th>
              <th className="r">Bid</th>
              <th className="r">Ask</th>
              <th className="r">Price</th>
              <th className="r">IV</th>
              <th className="r">Vol</th>
              <th className="r">OI chg%</th>
              <th className="r">OI chg</th>
              <th className="r">OI</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <OptionRow
                key={row.strike}
                row={row}
                atm={chain.atm}
                hover={hover === row.strike}
                onEnter={() => setHover(row.strike)}
                onLeave={() => setHover(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OptionRow({
  row,
  atm,
  hover,
  onEnter,
  onLeave,
}: {
  row: OptionStrikeRow;
  atm: number | null;
  hover?: boolean;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  const isAtm = atm != null && row.strike === atm;
  const ceItm = row.ce?.moneyness === "ITM";
  const peItm = row.pe?.moneyness === "ITM";
  return (
    <tr
      className={`${isAtm ? "atm" : ""} ${hover ? "hover" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <SideCells side={row.ce} />
      <td className={`strike-col ${ceItm ? "itm-ce" : ""} ${peItm ? "itm-pe" : ""}`}>
        {formatInt(row.strike)}
        <div className="page-sub">
          {row.ce?.moneyness ?? "—"} / {row.pe?.moneyness ?? "—"}
        </div>
      </td>
      <SideCells side={row.pe} mirror />
    </tr>
  );
}

export function OptionMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric">
      <div className="k">{label}</div>
      <div className="v num">{value || <NullCell />}</div>
    </div>
  );
}
