"use client";

import { DASH, formatNumber, formatOi, formatPcr, formatRatioPct } from "@/lib/format";
import { chainStatusLabel } from "@/api/envelope";
import { underlyingForSymbol } from "@/lib/instruments";
import { useOptionsData } from "@/market/hooks";
import { EmptyState } from "@/components/data/States";
import { ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";
import type { OptionSide } from "@/api/types";
import type { StrikeRangeId } from "@/terminal/types";

const RANGES: StrikeRangeId[] = [5, 10, 15];

export function OptionsWorkspace() {
  const {
    selectedInstrument,
    selectedExpiry,
    setExpiry,
    selectedStrikeRange,
    setStrikeRange,
  } = useTerminal();
  const underlying = underlyingForSymbol(selectedInstrument.symbol);
  const entry = useOptionsData(underlying, selectedExpiry);
  const chain = entry?.data ?? null;

  const atm = chain?.atm ?? null;
  const interval = chain?.strike_interval ?? null;
  const rows = (chain?.strikes ?? []).filter((row) => {
    if (atm === null || interval === null) return true;
    return Math.abs(row.strike - atm) <= selectedStrikeRange * interval;
  });

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
              value={selectedExpiry ?? chain?.expiry ?? ""}
              onChange={(e) => setExpiry(e.target.value || null)}
              aria-label="Option expiry"
              disabled={!chain}
            >
              {(chain?.available_expiries ?? (chain?.expiry ? [chain.expiry] : [])).map(
                (expiry) => (
                  <option key={expiry} value={expiry}>
                    {expiry}
                  </option>
                ),
              )}
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
          <span className="pulse-meta">Spot {formatNumber(chain?.spot)}</span>
          <span className="pulse-meta">PCR {formatPcr(chain?.pcr_oi)}</span>
          <span className="pulse-meta">{chainStatusLabel(chain?.chain_status, chain?.truncated)}</span>
        </div>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          title="Option chain unavailable"
          detail={unavailableDetail(underlying, entry?.status, entry?.reason)}
        />
      ) : (
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
              {rows.map((row) => {
                const isAtm = atm !== null && row.strike === atm;
                return (
                  <tr key={row.strike} className={isAtm ? "atm" : ""}>
                    <SideCells side={row.ce} />
                    <td className="c strike-h">
                      {formatNumber(row.strike, 0)}
                      {isAtm ? <span className="pulse-atm">ATM</span> : null}
                    </td>
                    <SideCells side={row.pe} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SideCells({ side }: { side: OptionSide | null }) {
  return (
    <>
      <td className="r num">{formatNumber(side?.ltp)}</td>
      <td className="r">
        {side?.price_change_pct == null ? (
          <span className="muted">{DASH}</span>
        ) : (
          <ToneValue value={side.price_change_pct}>
            {formatRatioPct(side.price_change_pct)}
          </ToneValue>
        )}
      </td>
      <td className="r num muted">{formatOi(side?.oi)}</td>
      <td className="r num muted">{side?.iv_pct == null ? DASH : side.iv_pct.toFixed(1)}</td>
    </>
  );
}

function unavailableDetail(
  underlying: string,
  status: string | undefined,
  reason: string | null | undefined,
): string {
  if (status === "loading" || status === "idle") return "Loading the option chain…";
  if (reason === "unreachable") return "The pipeline API is unreachable.";
  return `No option chain is published for ${underlying}${reason ? ` (${reason})` : ""}.`;
}
