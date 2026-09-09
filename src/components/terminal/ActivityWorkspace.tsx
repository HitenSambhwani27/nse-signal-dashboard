"use client";

import { useEffect, useMemo, useState } from "react";
import { DASH, formatNumber, formatSigned, formatVolume } from "@/lib/format";
import { useActivityFeed } from "@/market/hooks";
import { EmptyState } from "@/components/data/States";
import { useTerminal } from "@/terminal/context";
import type { UnusualActivityRow } from "@/api/types";
import type { ActivityFilter, ActivityTone } from "@/terminal/types";

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All signals" },
  { id: "positive", label: "Advancing" },
  { id: "negative", label: "Declining" },
  { id: "neutral", label: "Unchanged" },
];

/** Tone comes from the backend's own price change, not from a client model. */
function toneOf(row: UnusualActivityRow): ActivityTone {
  if (row.change == null || row.change === 0) return "neutral";
  return row.change > 0 ? "positive" : "negative";
}

/** Stable across refreshes so React keys and read state survive a resync. */
function rowId(row: UnusualActivityRow, index: number): string {
  return `${row.symbol ?? "unknown"}:${row.timestamp ?? index}`;
}

export function ActivityWorkspace() {
  const { liveScan, setLiveScan, activityFilter, setActivityFilter } = useTerminal();
  const entry = useActivityFeed();
  const live = useMemo(() => entry?.data ?? [], [entry]);

  // "Live scan" off holds the last snapshot instead of hiding the panel.
  const [held, setHeld] = useState<UnusualActivityRow[] | null>(null);
  useEffect(() => {
    setHeld(liveScan ? null : live);
    // Intentionally keyed on the toggle only: freeze the list at the moment it flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveScan]);

  const rows = held ?? live;
  const events = rows.filter(
    (row) => activityFilter === "all" || toneOf(row) === activityFilter,
  );

  const mix = rows.reduce(
    (acc, row) => {
      acc[toneOf(row)] += 1;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 },
  );
  const total = mix.positive + mix.negative + mix.neutral;
  const pos = total === 0 ? 0 : (mix.positive / total) * 100;
  const neg = total === 0 ? 0 : (mix.negative / total) * 100;

  const mostActive = rows.reduce<UnusualActivityRow | null>(
    (best, row) =>
      (row.activity_score ?? -Infinity) > (best?.activity_score ?? -Infinity) ? row : best,
    null,
  );
  const highestVolume = rows.reduce<UnusualActivityRow | null>(
    (best, row) => ((row.volume ?? -1) > (best?.volume ?? -1) ? row : best),
    null,
  );
  const largestTrade = rows.reduce<UnusualActivityRow | null>(
    (best, row) =>
      (row.trade_notional ?? -1) > (best?.trade_notional ?? -1) ? row : best,
    null,
  );

  return (
    <section className="pulse-ws pulse-activity" aria-label="Activity workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">MARKET ACTIVITY / LIVE SCAN</div>
          <h2 className="pulse-ws-title">Unusual activity</h2>
          <p className="pulse-inst-meta">
            Ranked by the pipeline&apos;s activity score.
            {entry?.asOf ? ` As of ${entry.asOf}.` : ""}
            {entry?.dataStatus ? ` Data status ${entry.dataStatus}.` : ""}
          </p>
        </div>
        <div className="pulse-ws-controls">
          <label className="pulse-switch">
            <input
              type="checkbox"
              checked={liveScan}
              onChange={(e) => setLiveScan(e.target.checked)}
            />
            Live scan
          </label>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`pulse-filter ${activityFilter === filter.id ? "active" : ""}`}
              onClick={() => setActivityFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          title="No unusual activity available"
          detail={
            entry?.status === "loading" || entry?.status === "idle"
              ? "Scanning the pipeline for unusual activity…"
              : `The pipeline reported no unusual activity${entry?.reason ? ` (${entry.reason})` : ""}.`
          }
        />
      ) : (
        <div className="pulse-activity-grid">
          <div className="pulse-feed">
            <div className="pulse-intel-kicker">
              LIVE ACTIVITY FEED{liveScan ? "" : " · PAUSED"}
            </div>
            {events.map((row, index) => (
              <article key={rowId(row, index)} className={`pulse-feed-row ${toneOf(row)}`}>
                <div>
                  <strong>{row.symbol ?? DASH}</strong>
                  <span>{row.activity_level ?? "Unclassified"}</span>
                  <p>{row.reasons?.join(" · ") || "No reason reported."}</p>
                </div>
                <div className="pulse-feed-meta">
                  <span className="num">
                    {formatNumber(row.price)}{" "}
                    {row.change == null ? null : `(${formatSigned(row.change)})`}
                  </span>
                  <time dateTime={row.timestamp ?? undefined}>{row.timestamp ?? DASH}</time>
                </div>
              </article>
            ))}
          </div>
          <aside className="pulse-mix">
            <div className="pulse-intel-kicker">SIGNAL MIX</div>
            <div
              className="pulse-donut"
              style={{
                background: `conic-gradient(#3dd68c 0 ${pos}%, #f07178 ${pos}% ${pos + neg}%, #e6b450 ${pos + neg}% 100%)`,
              }}
              role="img"
              aria-label={`${total} signals`}
            >
              <span>
                <strong>{total}</strong>
                signals
              </span>
            </div>
            <ul className="pulse-mix-legend">
              <li>
                <span className="swatch up" /> Advancing {mix.positive}
              </li>
              <li>
                <span className="swatch down" /> Declining {mix.negative}
              </li>
              <li>
                <span className="swatch warn" /> Unchanged {mix.neutral}
              </li>
            </ul>
            <div className="pulse-mix-stats">
              <div>
                <span>Highest activity score</span>
                <strong>{mostActive?.symbol ?? DASH}</strong>
              </div>
              <div>
                <span>Highest volume</span>
                <strong>
                  {highestVolume?.symbol ?? DASH}
                  {highestVolume?.volume == null ? "" : ` · ${formatVolume(highestVolume.volume)}`}
                </strong>
              </div>
              <div>
                <span>Largest trade notional</span>
                <strong>{largestTrade?.trade_notional == null ? DASH : largestTrade.symbol}</strong>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
