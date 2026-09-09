"use client";

import { formatNumber, formatOi, formatPct } from "@/lib/format";
import { ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";
import type { StrikeRangeId } from "@/terminal/types";

const RANGES: StrikeRangeId[] = [5, 10, 15];

export function OptionsWorkspace() {
  const {
    selectedInstrument,
    options,
    selectedExpiry,
    setExpiry,
    selectedStrikeRange,
    setStrikeRange,
  } = useTerminal();
  return (
    <section className="pulse-ws" aria-label="Options workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">DERIVATIVES / OPTION CHAIN</div>
          <div className="pulse-inst-name">
            {selectedInstrument.shortName}
            <span className="pulse-chip">NSE</span>
          </div>
        </div>
        <div className="pulse-ws-controls">
          <label>
            Expiry
            <select
              value={selectedExpiry}
              onChange={(e) => setExpiry(e.target.value)}
              aria-label="Option expiry"
            >
              {options.expiries.map((expiry) => (
                <option key={expiry} value={expiry}>
                  {expiry}
                </option>
              ))}
            </select>
          </label>
          <label>
            Strikes
            <select
              value={selectedStrikeRange}
              onChange={(e) => setStrikeRange(Number(e.target.value) as StrikeRangeId)}
              aria-label="Strike range"
            >
              {RANGES.map((range) => (
                <option key={range} value={range}>
                  ± {range} strikes
                </option>
              ))}
            </select>
          </label>
          <span className="pulse-meta">Spot {formatNumber(options.spot)}</span>
          <span className="pulse-meta">PCR {options.pcr.toFixed(2)}</span>
        </div>
      </header>
      <div className="pulse-table-scroll">
        <table className="pulse-table pulse-chain">
          <thead>
            <tr>
              <th colSpan={4} className="g">
                CALLS
              </th>
              <th className="c strike-h">STRIKE</th>
              <th colSpan={4} className="r-head">
                PUTS
              </th>
            </tr>
            <tr>
              <th className="r">LTP</th>
              <th className="r">CHG%</th>
              <th className="r">OI</th>
              <th className="r">IV</th>
              <th className="c strike-h">STRIKE</th>
              <th className="r">LTP</th>
              <th className="r">CHG%</th>
              <th className="r">OI</th>
              <th className="r">IV</th>
            </tr>
          </thead>
          <tbody>
            {options.rows.map((row) => (
              <tr key={row.strike} className={row.atm ? "atm" : ""}>
                <td className="r num">{formatNumber(row.call.ltp)}</td>
                <td className="r">
                  <ToneValue value={row.call.changePct}>{formatPct(row.call.changePct)}</ToneValue>
                </td>
                <td className="r num muted">{formatOi(row.call.oi)}</td>
                <td className="r num muted">{row.call.iv.toFixed(1)}</td>
                <td className="c strike-h">
                  {formatNumber(row.strike, 0)}
                  {row.atm ? <span className="pulse-atm">ATM</span> : null}
                </td>
                <td className="r num">{formatNumber(row.put.ltp)}</td>
                <td className="r">
                  <ToneValue value={row.put.changePct}>{formatPct(row.put.changePct)}</ToneValue>
                </td>
                <td className="r num muted">{formatOi(row.put.oi)}</td>
                <td className="r num muted">{row.put.iv.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
