"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTerminal } from "@/terminal/context";
import type { TerminalInstrument } from "@/terminal/types";

const DEBOUNCE_MS = 120;
const RESULT_LIMIT = 12;

function scoreInstrument(instrument: TerminalInstrument, needle: string): number {
  const symbol = instrument.symbol.toUpperCase();
  const name = instrument.shortName.toUpperCase();
  if (symbol === needle) return 0;
  if (name === needle) return 1;
  if (symbol.startsWith(needle)) return 2;
  if (name.startsWith(needle)) return 3;
  if (symbol.includes(needle)) return 4;
  if (name.includes(needle)) return 5;
  return 99;
}

function filterUniverse(
  instruments: readonly TerminalInstrument[],
  query: string,
): TerminalInstrument[] {
  const needle = query.trim().toUpperCase();
  if (!needle) return instruments.slice(0, RESULT_LIMIT);
  return instruments
    .map((instrument) => ({ instrument, score: scoreInstrument(instrument, needle) }))
    .filter((row) => row.score < 99)
    .sort((a, b) => a.score - b.score || a.instrument.symbol.localeCompare(b.instrument.symbol))
    .slice(0, RESULT_LIMIT)
    .map((row) => row.instrument);
}

/**
 * Client-side search over the terminal universe. There is no `/api/v1/search`
 * or `/instruments` route; tokens still come from quote resolution.
 */
export function PulseSearch() {
  const { instruments, tokensBySymbol, selectedInstrument, selectInstrument } = useTerminal();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const results = useMemo(
    () => filterUniverse(instruments, debounced),
    [instruments, debounced],
  );

  useEffect(() => setActive(0), [debounced, results.length]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(instrument: TerminalInstrument) {
    selectInstrument(instrument);
    setQuery("");
    setDebounced("");
    setOpen(false);
    input.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      input.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[active] ?? results[0];
      if (hit) choose(hit);
    }
  }

  return (
    <div className="pulse-search" ref={box}>
      <label className="pulse-search-label">
        <span className="visually-hidden">Search instruments, symbols or contracts</span>
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="Search instruments, symbols or contracts"
          aria-label="Search instruments, symbols or contracts"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="pulse-search-results"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      <kbd>⌘K</kbd>
      {open ? (
        <div className="pulse-search-results" id="pulse-search-results" role="listbox">
          {results.length === 0 ? (
            <div className="pulse-search-empty">No matching instruments in this terminal</div>
          ) : (
            results.map((instrument, index) => {
              const token = tokensBySymbol[instrument.symbol];
              const selected = instrument.symbol === selectedInstrument.symbol;
              return (
                <button
                  key={instrument.symbol}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`pulse-search-row ${index === active ? "active" : ""} ${selected ? "current" : ""}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(instrument)}
                >
                  <span className="pulse-search-sym">{instrument.shortName}</span>
                  <span className="pulse-search-meta">
                    {instrument.kind}
                    {token != null ? ` · ${token}` : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
