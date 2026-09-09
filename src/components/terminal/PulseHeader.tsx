"use client";

import { useEffect, useState } from "react";
import { PulseSearch } from "@/components/terminal/PulseSearch";
import { IconButton } from "@/components/terminal/primitives";
import { useLiveStatus, useMarketSession } from "@/market/hooks";
import { useTerminal } from "@/terminal/context";
import type { MarketState } from "@/worker/protocol";

const MARKET_STATE_LABELS: Record<MarketState, string> = {
  pre_open: "PRE-OPEN",
  open: "MARKET OPEN",
  post_close: "POST-CLOSE",
  closed: "MARKET CLOSED",
  weekend: "WEEKEND",
  holiday: "HOLIDAY",
  unknown: "SESSION UNKNOWN",
};

export function PulseHeader() {
  const { toggleNav, toggleWatch, toggleIntel } = useTerminal();
  const status = useLiveStatus();
  const session = useMarketSession();
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="pulse-header">
      <div className="pulse-brand">
        <span className="pulse-logo" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 13h3l2-6 4 12 3-8 2 2h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span>
          <span className="pulse-brand-name">PULSE TERMINAL</span>
          <span className="pulse-brand-sub">NSE MARKET INTELLIGENCE</span>
        </span>
      </div>
      <PulseSearch />
      <div className="pulse-status">
        <span
          className="pulse-live"
          title={session?.sessionDate ?? undefined}
          data-testid="market-status"
        >
          <span className="pulse-dot" />
          {session ? MARKET_STATE_LABELS[session.marketState] : "AWAITING SESSION"}
        </span>
        <span className="pulse-chip">NSE</span>
        <span
          className={`pulse-chip stream ${status.kind}`}
          title={status.detail ?? "SSE transport status — not market state"}
          data-testid="stream-status"
        >
          <span className="pulse-dot" />
          {status.label}
        </span>
        <span
          className="pulse-chip muted"
          title={session?.asOf ?? "Backend data_status"}
          data-testid="data-status"
        >
          {dataStatusLabel(session?.dataStatus)}
        </span>
        {status.lagMs === null ? null : (
          <span className="pulse-chip" title="Server-reported ingest lag from the stream heartbeat">
            Lag {Math.round(status.lagMs)}ms
          </span>
        )}
        <time className="pulse-clock" dateTime={clock}>
          {clock || "--:--:--"}
        </time>
        <IconButton label="Notifications">
          <BellIcon />
        </IconButton>
        <button type="button" className="pulse-user" aria-haspopup="menu" aria-label="User menu">
          <span className="pulse-avatar">AS</span>
          Arjun S.
          <span aria-hidden>▾</span>
        </button>
        <div className="pulse-collapse-tools">
          <IconButton label="Toggle navigation" onClick={toggleNav}>
            ☰
          </IconButton>
          <IconButton label="Toggle marketwatch" onClick={toggleWatch}>
            MW
          </IconButton>
          <IconButton label="Toggle trade intelligence" onClick={toggleIntel}>
            TI
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function dataStatusLabel(status: string | null | undefined): string {
  if (!status) return "DATA UNAVAILABLE";
  return status.replace(/_/g, " ").toUpperCase();
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
