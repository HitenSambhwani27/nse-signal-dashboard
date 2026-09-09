"use client";

import { useTerminal } from "@/terminal/context";

export function ActivityWorkspace() {
  const { activity, liveScan, setLiveScan, activityFilter, setActivityFilter } = useTerminal();
  const total = activity.mix.positive + activity.mix.negative + activity.mix.neutral;
  const events =
    activityFilter === "all"
      ? activity.events
      : activity.events.filter((event) => event.tone === activityFilter);
  const pos = (activity.mix.positive / total) * 100;
  const neg = (activity.mix.negative / total) * 100;
  return (
    <section className="pulse-ws pulse-activity" aria-label="Activity workspace">
      <header className="pulse-ws-head">
        <div>
          <div className="pulse-kicker">MARKET ACTIVITY / LIVE SCAN</div>
          <h2 className="pulse-ws-title">Unusual activity</h2>
          <p className="pulse-inst-meta">
            Events ranked by relative volume, OI delta, and price response. Phase 6A visual fixtures.
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
          <button
            type="button"
            className={`pulse-filter ${activityFilter === "all" ? "active" : ""}`}
            onClick={() => setActivityFilter("all")}
          >
            All signals
          </button>
        </div>
      </header>
      <div className="pulse-activity-grid">
        <div className="pulse-feed">
          <div className="pulse-intel-kicker">LIVE ACTIVITY FEED</div>
          {events.map((event) => (
            <article key={event.id} className={`pulse-feed-row ${event.tone}`}>
              <div>
                <strong>{event.instrument}</strong>
                <span>{event.event}</span>
                <p>{event.description}</p>
              </div>
              <div className="pulse-feed-meta">
                <span className="num">{event.value}</span>
                <time>{event.timestampLabel}</time>
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
              <span className="swatch up" /> Positive {activity.mix.positive}
            </li>
            <li>
              <span className="swatch down" /> Negative {activity.mix.negative}
            </li>
            <li>
              <span className="swatch warn" /> Neutral {activity.mix.neutral}
            </li>
          </ul>
          <div className="pulse-mix-stats">
            <div>
              <span>Most active</span>
              <strong>{activity.mostActive}</strong>
            </div>
            <div>
              <span>Highest volume</span>
              <strong>{activity.highestVolume}</strong>
            </div>
            <div>
              <span>Largest OI delta</span>
              <strong>{activity.largestOiDelta}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
