"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDEX_INSTRUMENTS, displayName, symbolHref, underlyingForSymbol } from "@/lib/instruments";

export function GlobalSearch({ symbols }: { symbols: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim().toUpperCase()), 120);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const universe = new Set<string>([
      ...INDEX_INSTRUMENTS.map((i) => i.spotSymbol),
      ...INDEX_INSTRUMENTS.map((i) => i.underlying),
      ...symbols,
    ]);
    const list = [...universe];
    if (!debounced) return list.slice(0, 8).map((s) => ({ symbol: s, label: displayName(s) }));
    const hits = list
      .filter((s) => s.toUpperCase().includes(debounced))
      .slice(0, 12)
      .map((s) => ({ symbol: s, label: displayName(s) }));
    if (!hits.some((h) => h.symbol.toUpperCase() === debounced)) {
      hits.unshift({ symbol: debounced, label: debounced });
    }
    return hits;
  }, [debounced, symbols]);

  function go(symbol: string, dest: "overview" | "options" | "futures" | "chart" | "activity") {
    const und = underlyingForSymbol(symbol);
    if (dest === "options") router.push(`/options/${encodeURIComponent(und)}`);
    else if (dest === "futures") router.push(`/futures/${encodeURIComponent(und)}`);
    else if (dest === "chart") router.push(symbolHref(symbol, "chart"));
    else if (dest === "activity") router.push(symbolHref(symbol, "activity"));
    else router.push(symbolHref(symbol));
    setOpen(false);
    setQ("");
  }

  return (
    <div className="search-wrap" ref={box}>
      <input
        ref={input}
        placeholder="Search symbol  ⌘K"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].symbol, "overview");
        }}
        aria-label="Global symbol search"
      />
      {open ? (
        <div className="search-results">
          {results.map((row) => (
            <div key={row.symbol} style={{ borderBottom: "1px solid var(--border)" }}>
              <Link href={symbolHref(row.symbol)} onClick={() => setOpen(false)}>
                <strong>{row.label}</strong>
                <span className="page-sub">{row.symbol}</span>
              </Link>
              <div className="row" style={{ padding: "0 8px 8px" }}>
                <button className="btn" onClick={() => go(row.symbol, "options")}>
                  Options
                </button>
                <button className="btn" onClick={() => go(row.symbol, "futures")}>
                  Futures
                </button>
                <button className="btn" onClick={() => go(row.symbol, "chart")}>
                  Chart
                </button>
                <button className="btn" onClick={() => go(row.symbol, "activity")}>
                  Activity
                </button>
              </div>
            </div>
          ))}
          <div style={{ padding: 8, color: "var(--text-faint)" }}>
            Type any backend symbol. Universe comes from watchlists plus index underlyings — not a hardcoded Nifty 100 book.
          </div>
        </div>
      ) : null}
    </div>
  );
}
