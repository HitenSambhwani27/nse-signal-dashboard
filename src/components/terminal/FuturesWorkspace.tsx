"use client";

import {
  DASH,
  formatNumber,
  formatOi,
  formatRatioPct,
  formatSigned,
  formatVolume,
} from "@/lib/format";
import { underlyingForSymbol } from "@/lib/instruments";
import { useFuturesData } from "@/market/hooks";
import { EmptyState } from "@/components/data/States";
import { Badge, ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";

/** Mirrors the backend's own `price_oi` vocabulary; no client-side classifier. */
function buildupTone(label: string | null): "up" | "down" | "warn" | "neutral" {
  if (label === null) return "neutral";
  const text = label.toLowerCase();
  if (text.includes("long buildup") || text.includes("short covering")) return "up";
  if (text.includes("short buildup") || text.includes("long unwinding")) return "down";
  return "neutral";
}

export function FuturesWorkspace() {
  const { selectedInstrument } = useTerminal();
  const underlying = underlyingForSymbol(selectedInstrument.symbol);
  const entry = useFuturesData(underlying);
  const book = entry?.data ?? null;
  const contracts = book?.contracts ?? [];
  const near = contracts[0] ?? null;

  return (
    <section className="pulse-ws" aria-label="Futures workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">DERIVATIVES / FUTURES CURVE</div>
          <div className="pulse-inst-name">
            {selectedInstrument.shortName}
            <span className="pulse-chip">NSE</span>
          </div>
          <div className="pulse-inst-meta">
            Basis structure and open interest · Spot {formatNumber(book?.spot)}
          </div>
        </div>
        <span className="pulse-meta">
          {entry?.dataStatus ? `Data status: ${entry.dataStatus}` : "Data status unknown"}
        </span>
      </header>
      {contracts.length === 0 ? (
        <EmptyState
          title="Futures book unavailable"
          detail={
            entry?.status === "loading" || entry?.status === "idle"
              ? "Loading the futures book…"
              : `No futures contracts are published for ${underlying}${entry?.reason ? ` (${entry.reason})` : ""}.`
          }
        />
      ) : (
        <>
          <div className="pulse-table-scroll">
            <table className="pulse-table">
              <thead>
                <tr>
                  <th>CONTRACT</th>
                  <th className="r">LTP</th>
                  <th className="r">CHG</th>
                  <th className="r">BASIS</th>
                  <th className="r">OI</th>
                  <th className="r">VOLUME</th>
                  <th>BUILD-UP</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((row, index) => (
                  <tr key={row.symbol ?? row.expiry ?? `contract-${index}`}>
                    <td className="sym">{row.symbol ?? DASH}</td>
                    <td className="r num">{formatNumber(row.ltp)}</td>
                    <td className="r">
                      {row.price_change == null ? (
                        <span className="muted">{DASH}</span>
                      ) : (
                        <ToneValue value={row.price_change}>
                          {formatSigned(row.price_change)}
                        </ToneValue>
                      )}
                    </td>
                    <td className="r num">
                      {row.basis == null ? (
                        <span className="muted" title={row.basis_status ?? undefined}>
                          {row.basis_status ?? DASH}
                        </span>
                      ) : (
                        formatSigned(row.basis)
                      )}
                    </td>
                    <td className="r num muted">{formatOi(row.oi)}</td>
                    <td className="r num muted">{formatVolume(row.volume)}</td>
                    <td>
                      {row.price_oi?.label ? (
                        <Badge tone={buildupTone(row.price_oi.label)}>{row.price_oi.label}</Badge>
                      ) : (
                        <span className="muted">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="pulse-fut-sum">
            <span>
              Near basis{" "}
              <strong className="num">
                {near?.basis == null ? (near?.basis_status ?? DASH) : formatSigned(near.basis)}
              </strong>
            </span>
            <span>
              Near OI change{" "}
              <strong className="num">
                {near?.oi_change_pct == null ? DASH : formatRatioPct(near.oi_change_pct)}
              </strong>
            </span>
            <span>
              Read-through <strong>{near?.price_oi?.label ?? "Unavailable"}</strong>
            </span>
            <span>
              Spot as of <strong className="num">{book?.spot_as_of ?? DASH}</strong>
            </span>
          </footer>
        </>
      )}
    </section>
  );
}
