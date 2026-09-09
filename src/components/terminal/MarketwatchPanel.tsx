"use client";

import { formatNumber, formatPct, formatVolume, signedTone } from "@/lib/format";
import { PHASE6A_INDEX_STRIP, PHASE6A_MARKETWATCH } from "@/fixtures/phase6a";
import { PanelHead, ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";

export function MarketwatchPanel() {
  const { selectedInstrument, selectInstrument } = useTerminal();
  return (
    <section className="pulse-watch" aria-label="Marketwatch">
      <PanelHead
        title="Marketwatch"
        meta={<span className="pulse-meta">{PHASE6A_MARKETWATCH.length} instruments</span>}
      />
      <div className="pulse-index-strip">
        {PHASE6A_INDEX_STRIP.map((item) => (
          <span key={item.label}>
            {item.label}{" "}
            {item.changePct == null ? (
              <span className="num">{item.last}</span>
            ) : (
              <ToneValue value={item.changePct}>{formatPct(item.changePct)}</ToneValue>
            )}
          </span>
        ))}
      </div>
      <div className="pulse-table-scroll">
        <table className="pulse-table">
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th className="r">LTP</th>
              <th className="r">CHG%</th>
              <th className="r">VOL</th>
              <th className="r">OI</th>
              <th className="r">BID</th>
              <th className="r">ASK</th>
            </tr>
          </thead>
          <tbody>
            {PHASE6A_MARKETWATCH.map((row) => {
              const selected = row.instrument.symbol === selectedInstrument.symbol;
              return (
                <tr
                  key={row.instrument.symbol}
                  className={`${signedTone(row.changePct)} ${selected ? "selected" : ""}`}
                  onClick={() => selectInstrument(row.instrument)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectInstrument(row.instrument);
                    }
                  }}
                  aria-selected={selected}
                  aria-label={row.instrument.shortName}
                >
                  <td className="sym">{row.instrument.shortName}</td>
                  <td className="r num">{formatNumber(row.ltp)}</td>
                  <td className="r">
                    <ToneValue value={row.changePct}>{formatPct(row.changePct)}</ToneValue>
                  </td>
                  <td className="r num muted">{formatVolume(row.volume)}</td>
                  <td className="r num muted">{formatVolume(row.oi)}</td>
                  <td className="r num">{formatNumber(row.bid)}</td>
                  <td className="r num">{formatNumber(row.ask)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
