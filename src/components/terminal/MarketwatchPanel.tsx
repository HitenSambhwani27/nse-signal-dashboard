"use client";

import { memo } from "react";
import { DASH, formatNumber, formatPct, formatVolume, signedTone } from "@/lib/format";
import { useInstrumentQuote } from "@/market/hooks";
import { PanelHead, ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";
import { INDEX_STRIP } from "@/terminal/universe";
import type { TerminalInstrument } from "@/terminal/types";

export function MarketwatchPanel() {
  const { instruments, tokensBySymbol, selectedInstrument, selectInstrument } = useTerminal();
  const resolved = instruments.filter((i) => tokensBySymbol[i.symbol] !== undefined).length;

  return (
    <section className="pulse-watch" aria-label="Marketwatch">
      <PanelHead
        title="Marketwatch"
        meta={
          <span className="pulse-meta">
            {resolved}/{instruments.length} live
          </span>
        }
      />
      <div className="pulse-index-strip">
        {INDEX_STRIP.map((item) => (
          <IndexChip
            key={item.symbol}
            instrument={item}
            token={tokensBySymbol[item.symbol] ?? null}
          />
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
            {instruments.map((instrument) => (
              <MarketwatchRow
                key={instrument.symbol}
                instrument={instrument}
                token={tokensBySymbol[instrument.symbol] ?? null}
                selected={instrument.symbol === selectedInstrument.symbol}
                onSelect={selectInstrument}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * One row = one subscription. A tick for HDFCBANK notifies only this row, so
 * the rest of the terminal does not re-render (§11).
 */
const MarketwatchRow = memo(function MarketwatchRow({
  instrument,
  token,
  selected,
  onSelect,
}: {
  instrument: TerminalInstrument;
  token: number | null;
  selected: boolean;
  onSelect: (instrument: TerminalInstrument) => void;
}) {
  const quote = useInstrumentQuote(token);
  const select = () => onSelect(instrument);

  return (
    <tr
      className={`${signedTone(quote?.changePct)} ${selected ? "selected" : ""}`}
      onClick={select}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select();
        }
      }}
      aria-selected={selected}
      aria-label={instrument.shortName}
    >
      <td className="sym">{instrument.shortName}</td>
      <td className="r num">{formatNumber(quote?.ltp)}</td>
      <td className="r">
        {quote?.changePct == null ? (
          <span className="muted">{DASH}</span>
        ) : (
          <ToneValue value={quote.changePct}>{formatPct(quote.changePct)}</ToneValue>
        )}
      </td>
      <td className="r num muted">{formatVolume(quote?.volume)}</td>
      <td className="r num muted">{formatVolume(quote?.oi)}</td>
      <td className="r num">{formatNumber(quote?.bid)}</td>
      <td className="r num">{formatNumber(quote?.ask)}</td>
    </tr>
  );
});

const IndexChip = memo(function IndexChip({
  instrument,
  token,
}: {
  instrument: TerminalInstrument;
  token: number | null;
}) {
  const quote = useInstrumentQuote(token);
  return (
    <span>
      {instrument.shortName}{" "}
      {quote?.changePct == null ? (
        <span className="num muted">{formatNumber(quote?.ltp)}</span>
      ) : (
        <ToneValue value={quote.changePct}>{formatPct(quote.changePct)}</ToneValue>
      )}
    </span>
  );
});
