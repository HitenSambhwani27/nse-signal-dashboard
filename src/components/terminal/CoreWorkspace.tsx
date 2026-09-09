"use client";

import {
  DASH,
  formatNumber,
  formatPct,
  formatSigned,
  formatTime,
  signedTone,
} from "@/lib/format";
import { useInstrumentQuote, useMarketSession } from "@/market/hooks";
import { ToneValue } from "@/components/terminal/primitives";
import { TerminalChart } from "@/components/terminal/TerminalChart";
import { useTerminal } from "@/terminal/context";
import { TERMINAL_TIMEFRAMES, timeframeLabel } from "@/terminal/universe";
import type { TimeframeId } from "@/terminal/types";

const SESSION_LABELS: Record<string, string> = {
  pre_open: "Pre-open",
  open: "Market open",
  post_close: "Post-close",
  closed: "Market closed",
  weekend: "Weekend",
  holiday: "Holiday",
  unknown: "Session unknown",
};

export function CoreWorkspace() {
  const {
    selectedInstrument,
    selectedToken,
    favorite,
    toggleFavorite,
    selectedTimeframe,
    setTimeframe,
  } = useTerminal();
  const quote = useInstrumentQuote(selectedToken);
  const session = useMarketSession();
  const tone = signedTone(quote?.changePct);
  const lotSize = quote?.meta.lotSize ?? null;

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
            {selectedInstrument.shortName}
            <span className="pulse-chip">NSE</span>
            <span className="pulse-chip muted">
              {quote?.meta.instrumentType ?? selectedInstrument.kind}
            </span>
          </div>
          <div className="pulse-inst-meta">
            {session ? SESSION_LABELS[session.marketState] ?? session.marketState : "Awaiting session"}
            <span>Tick size {quote?.meta.tickSize == null ? DASH : `₹${quote.meta.tickSize.toFixed(2)}`}</span>
            <span>Lot size {lotSize == null ? DASH : lotSize}</span>
            <span>Updated {formatTime(quote?.timestamp)}</span>
          </div>
        </div>
        <div className="pulse-px-block">
          <div className="pulse-px">{formatNumber(quote?.ltp)}</div>
          {quote?.changePct == null ? (
            <span className="pulse-px-chg muted">Change unavailable</span>
          ) : (
            <ToneValue value={quote.changePct} className="pulse-px-chg">
              {formatSigned(quote.change)} ({formatPct(quote.changePct)})
            </ToneValue>
          )}
        </div>
        <div className="pulse-trade-btns">
          <button type="button" className="pulse-buy" aria-label="Buy (visual placeholder)">
            Buy <span>{lotSize ?? DASH}</span>
          </button>
          <button type="button" className="pulse-sell" aria-label="Sell (visual placeholder)">
            Sell <span>{lotSize ?? DASH}</span>
          </button>
        </div>
      </header>
      <div className="pulse-chart-toolbar">
        <div className="pulse-tf" role="tablist" aria-label="Chart timeframe">
          {TERMINAL_TIMEFRAMES.map((tf: TimeframeId) => (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={selectedTimeframe === tf}
              className={selectedTimeframe === tf ? "active" : ""}
              onClick={() => setTimeframe(tf)}
            >
              {timeframeLabel(tf)}
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
