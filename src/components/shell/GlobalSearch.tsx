"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { WatchlistQuoteRow } from "@/api/types";
import {
  buildSearchUniverse,
  destinationForHit,
  filterSearchUniverse,
  groupSearchHits,
  kindLabel,
  type SearchInstrument,
} from "@/lib/search";

export function GlobalSearch({
  symbols,
  quotes = [],
  loading = false,
}: {
  symbols: string[];
  quotes?: WatchlistQuoteRow[];
  loading?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const universe = useMemo(() => buildSearchUniverse(symbols, quotes), [symbols, quotes]);
  const results = useMemo(() => filterSearchUniverse(universe, q), [universe, q]);
  const groups = useMemo(() => groupSearchHits(results), [results]);

  useEffect(() => setActive(0), [q, results.length]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
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

  function go(hit: SearchInstrument) {
    router.push(destinationForHit(hit));
    setOpen(false);
    setQ("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active] ?? results[0];
      if (hit) go(hit);
    }
  }

  let cursor = -1;

  return (
    <div className="search-wrap" ref={box}>
      <input
        ref={input}
        placeholder="Search stocks, indices, futures…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search stocks, indices, futures"
        aria-autocomplete="list"
      />
      {open ? (
        <div className="search-results" role="listbox">
          {loading && !symbols.length ? (
            <div className="search-empty">Loading instruments…</div>
          ) : null}
          {!loading || symbols.length ? (
            results.length ? (
              groups.map((group) => (
                <div key={group.kind} className="search-group">
                  <div className="search-group-h">{group.label}</div>
                  {group.hits.map((hit) => {
                    cursor += 1;
                    const index = cursor;
                    return (
                      <button
                        key={`${hit.kind}-${hit.symbol}-${hit.href}`}
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`search-row ${index === active ? "active" : ""}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(hit)}
                      >
                        <span className="search-sym">{hit.symbol}</span>
                        <span className="search-name">{hit.name}</span>
                        <span className="search-kind">{kindLabel(hit.kind)}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="search-empty">No matching instruments</div>
            )
          ) : null}
          <div className="search-hint">
            {results[active] ? `Enter opens ${results[active].symbol}` : "Type to filter watchlist and index symbols"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
