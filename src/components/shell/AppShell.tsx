"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { quotesPath } from "@/api/quotes";
import { healthPath } from "@/api/pipeline";
import { watchlistQuotesPath, watchlistsPath } from "@/api/watchlists";
import type { HealthResponse, QuoteResponse, WatchlistQuotesResponse, WatchlistsResponse } from "@/api/types";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { MarketTicker } from "@/components/shell/MarketTicker";
import { MaturityStrip } from "@/components/shell/MaturityStrip";
import { useApiQuery } from "@/hooks/useApiQuery";
import { marketStatus } from "@/lib/freshness";
import { INDEX_INSTRUMENTS, NAV_ITEMS } from "@/lib/instruments";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nifty = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[0].spotSymbol), 5000);
  const bank = useApiQuery<QuoteResponse>(quotesPath(INDEX_INSTRUMENTS[1].spotSymbol), 5000);
  const health = useApiQuery<HealthResponse>(healthPath(), 8000);
  const lists = useApiQuery<WatchlistsResponse>(watchlistsPath(), 30_000);
  const listQuotes = useApiQuery<WatchlistQuotesResponse>(watchlistQuotesPath(), 8_000);

  const symbols = useMemo(() => {
    const out: string[] = [];
    for (const item of lists.data?.watchlists ?? []) {
      for (const s of item.symbols ?? []) out.push(s);
    }
    return out;
  }, [lists.data]);

  const selectedList = lists.data?.watchlists?.[0]?.name ?? null;
  const asOf = nifty.data?.quote?.timestamp ?? bank.data?.quote?.timestamp ?? health.data?.as_of;
  const status = marketStatus({
    asOf,
    lastIngest: health.data?.health?.last_ingestion_meta?.timestamp,
    found: nifty.data?.found || bank.data?.found,
  });
  const connected =
    health.status === "ok"
      ? health.data?.health?.api === "ok"
        ? "API connected"
        : "API degraded"
      : health.status === "loading"
        ? "Connecting"
        : "No live data";

  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      <header className="topbar">
        <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          ☰
        </button>
        <Link className="brand" href="/">
          <span className="brand-mark" />
          <span className="brand-name">NSE Terminal</span>
          <span className="brand-sub">Client</span>
        </Link>
        <GlobalSearch
          symbols={symbols}
          quotes={listQuotes.data?.quotes ?? []}
          loading={lists.status === "loading" && !lists.data}
        />
        <MarketTicker
          nifty={nifty.data?.quote ?? null}
          banknifty={bank.data?.quote ?? null}
        />
        <div className="status-cluster">
          <span className={`badge ${status.kind === "receiving" ? "fresh" : status.kind === "market_closed" ? "muted" : "warning"}`}>
            <span className={`dot ${status.kind === "receiving" ? "fresh" : status.kind === "market_closed" ? "closed" : "stale"}`} />
            {status.label}
          </span>
          <span className={`badge ${connected === "API connected" ? "fresh" : "warning"}`}>
            {connected}
          </span>
          {selectedList ? <span className="badge muted">WL {selectedList}</span> : null}
          <span className="user-chip">Client</span>
        </div>
      </header>
      <MaturityStrip
        maturity={
          health.data?.maturity ?? nifty.data?.maturity ?? bank.data?.maturity ?? null
        }
      />
      <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      <nav className="sidebar">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`) ||
                (item.label === "Options" && pathname.startsWith("/options")) ||
                (item.label === "Futures" && pathname.startsWith("/futures")) ||
                (item.label === "Charts" && pathname.startsWith("/charts")) ||
                (item.label === "Activity" && pathname.startsWith("/activity")) ||
                (item.label === "Unusual" && pathname.startsWith("/unusual")) ||
                (item.label === "Cross-market" && pathname.startsWith("/cross-market")) ||
                (item.label === "Watchlists" && pathname.startsWith("/watchlists")) ||
                (item.label === "Markets" && pathname.startsWith("/markets"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
        <div className="nav-spacer" />
        <Link
          href="/settings"
          className={`nav-item ${pathname.startsWith("/settings") ? "active" : ""}`}
          onClick={() => setOpen(false)}
        >
          Settings
        </Link>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
