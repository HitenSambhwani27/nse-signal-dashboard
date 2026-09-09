"use client";

import { useState } from "react";
import { formatNumber, formatOi, formatSigned, formatVolume } from "@/lib/format";
import { Badge, ToneValue } from "@/components/terminal/primitives";
import { useTerminal } from "@/terminal/context";
import type { BuildupLabel } from "@/terminal/types";

function buildupTone(label: BuildupLabel): "up" | "down" | "warn" | "neutral" {
  if (label === "Long buildup" || label === "Short covering") return "up";
  if (label === "Short buildup" || label === "Long unwinding") return "down";
  return "neutral";
}

export function FuturesWorkspace() {
  const { selectedInstrument, futures } = useTerminal();
  const [profile, setProfile] = useState(futures.volumeProfile);
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
            Basis structure and open interest context · Spot {formatNumber(futures.spot)}
          </div>
        </div>
        <label>
          Volume profile
          <select
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            aria-label="Volume profile"
          >
            <option>Session</option>
            <option>Intraday</option>
            <option>Expiry</option>
          </select>
        </label>
      </header>
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
            {futures.rows.map((row) => (
              <tr key={row.contract}>
                <td className="sym">{row.contract}</td>
                <td className="r num">{formatNumber(row.ltp)}</td>
                <td className="r">
                  <ToneValue value={row.changeAbs}>{formatSigned(row.changeAbs)}</ToneValue>
                </td>
                <td className="r num">{formatSigned(row.basis)}</td>
                <td className="r num muted">{formatOi(row.oi)}</td>
                <td className="r num muted">{formatVolume(row.volume)}</td>
                <td>
                  <Badge tone={buildupTone(row.buildup)}>{row.buildup}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="pulse-fut-sum">
        <span>
          Curve slope <strong className="pulse-tone up">{futures.curveSlope}</strong>
        </span>
        <span>
          Near basis <strong className="num">{formatSigned(futures.nearBasis)}</strong>
        </span>
        <span>
          OI change{" "}
          <strong className="pulse-tone up">{formatSigned(futures.oiChangePct)}%</strong>
        </span>
        <span>
          Read-through <strong>{futures.readThrough}</strong>
        </span>
      </footer>
    </section>
  );
}
