"use client";

import { formatNumber, formatSigned, signedTone } from "@/lib/format";
import { ToneValue } from "@/components/terminal/primitives";
import { TerminalChart } from "@/components/terminal/TerminalChart";
import { useTerminal } from "@/terminal/context";
import type { TimeframeId } from "@/terminal/types";

const TIMEFRAMES: TimeframeId[] = ["1m", "5m", "15m", "1h", "1D"];

export function CoreWorkspace() {
  const { core, favorite, toggleFavorite, selectedTimeframe, setTimeframe } = useTerminal();
  const tone = signedTone(core.changePct);
  return (
    <section className="pulse-core" aria-label="Core workspace">
      <header className="pulse-inst-head">
        <button
          type="button"
          className={`pulse-star ${favorite ? "on" : ""}`}
          aria-pressed={favorite}
          aria-label={favorite ? "Remove favorite" : "Add favorite"}
          onClick={toggleFavorite}
        >
          ★
        </button>
        <div>
          <div className="pulse-inst-name">
            {core.instrument.shortName}
            <span className="pulse-chip">NSE</span>
            <span className="pulse-chip muted">{core.instrument.kind}</span>
          </div>
          <div className="pulse-inst-meta">
            {core.marketStateLabel}
            <span>Tick size ₹{core.tickSize.toFixed(2)}</span>
            <span>Lot size {core.lotSize}</span>
            <span>Updated {core.updatedLabel}</span>
          </div>
        </div>
        <div className="pulse-px-block">
          <div className="pulse-px">{formatNumber(core.ltp)}</div>
          <ToneValue value={core.changePct} className="pulse-px-chg">
            {formatSigned(core.changeAbs)} ({core.changePct > 0 ? "+" : ""}
            {core.changePct.toFixed(2)}%)
          </ToneValue>
        </div>
        <div className="pulse-trade-btns">
          <button type="button" className="pulse-buy" aria-label="Buy (visual placeholder)">
            Buy <span>{core.lotSize}</span>
          </button>
          <button type="button" className="pulse-sell" aria-label="Sell (visual placeholder)">
            Sell <span>{core.lotSize}</span>
          </button>
        </div>
      </header>
      <div className="pulse-chart-toolbar">
        <div className="pulse-tf" role="tablist" aria-label="Chart timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={selectedTimeframe === tf}
              className={selectedTimeframe === tf ? "active" : ""}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="pulse-chart-tools">
          <button type="button" className="active" aria-pressed="true">
            Crosshair
          </button>
          <button type="button">Draw</button>
          <button type="button">Indicators</button>
        </div>
      </div>
      <div className={`pulse-chart-wrap ${tone}`}>
        <TerminalChart />
      </div>
    </section>
  );
}
