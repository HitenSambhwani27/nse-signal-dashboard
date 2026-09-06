import type { Quote, WatchlistQuoteRow } from "@/api/types";
import {
  INDEX_INSTRUMENTS,
  displayName,
  symbolHref,
  underlyingForSymbol,
} from "@/lib/instruments";

export type InstrumentKind = "index" | "stock" | "future" | "option";

export interface SearchInstrument {
  symbol: string;
  name: string;
  kind: InstrumentKind;
  exchange?: string | null;
  href: string;
}

const OPTION_CONTRACT = /(?:\d{2,}|[A-Z]{3}\d{2})(CE|PE)$/i;
const FUTURE_CONTRACT = /FUT$/i;

export function isOptionContract(symbol: string, instrumentType?: string | null): boolean {
  const type = (instrumentType || "").toUpperCase();
  if (type === "CE" || type === "PE") return true;
  return OPTION_CONTRACT.test(symbol.replace(/\s+/g, ""));
}

export function isFutureContract(symbol: string, instrumentType?: string | null): boolean {
  const type = (instrumentType || "").toUpperCase();
  if (type === "FUT") return true;
  return FUTURE_CONTRACT.test(symbol.toUpperCase());
}

export function classifyInstrument(
  symbol: string,
  quote?: Quote | null,
): InstrumentKind {
  const upper = symbol.trim().toUpperCase();
  if (
    INDEX_INSTRUMENTS.some((i) => i.spotSymbol === upper || i.underlying === upper || i.label === upper)
  ) {
    return "index";
  }
  if (isOptionContract(symbol, quote?.instrument_type)) return "option";
  if (isFutureContract(symbol, quote?.instrument_type)) return "future";
  const type = (quote?.instrument_type || "").toUpperCase();
  if (type === "EQ" || type === "INDEX") return type === "INDEX" ? "index" : "stock";
  return "stock";
}

export function kindLabel(kind: InstrumentKind): string {
  if (kind === "index") return "INDEX";
  if (kind === "stock") return "STOCK";
  if (kind === "future") return "FUTURE";
  return "OPTIONS";
}

function pushUnique(out: SearchInstrument[], hit: SearchInstrument) {
  if (out.some((h) => h.symbol === hit.symbol && h.href === hit.href)) return;
  out.push(hit);
}

export function buildSearchUniverse(
  symbols: string[],
  quotes: WatchlistQuoteRow[] = [],
): SearchInstrument[] {
  const bySymbol = new Map(quotes.map((row) => [row.symbol.toUpperCase(), row]));
  const out: SearchInstrument[] = [];

  for (const index of INDEX_INSTRUMENTS) {
    const spotQuote = bySymbol.get(index.spotSymbol.toUpperCase())?.quote ?? null;
    pushUnique(out, {
      symbol: index.spotSymbol,
      name: index.label,
      kind: "index",
      exchange: spotQuote?.exchange ?? "NSE",
      href: symbolHref(index.spotSymbol),
    });
    pushUnique(out, {
      symbol: index.underlying,
      name: `${index.label} options / futures`,
      kind: "option",
      exchange: "NFO",
      href: `/options/${encodeURIComponent(index.underlying)}`,
    });
  }

  for (const symbol of symbols) {
    const row = bySymbol.get(symbol.toUpperCase());
    const quote = row?.quote ?? null;
    const kind = classifyInstrument(symbol, quote);
    if (kind === "option") continue;
    pushUnique(out, {
      symbol,
      name: quote?.underlying && quote.underlying !== symbol ? quote.underlying : displayName(symbol),
      kind,
      exchange: quote?.exchange ?? null,
      href: symbolHref(symbol),
    });
  }

  for (const row of quotes) {
    const kind = classifyInstrument(row.symbol, row.quote);
    if (kind === "option") continue;
    pushUnique(out, {
      symbol: row.symbol,
      name:
        row.quote?.underlying && row.quote.underlying !== row.symbol
          ? row.quote.underlying
          : displayName(row.symbol),
      kind,
      exchange: row.quote?.exchange ?? null,
      href: symbolHref(row.symbol),
    });
  }

  return out;
}

function scoreHit(hit: SearchInstrument, needle: string): number {
  const symbol = hit.symbol.toUpperCase();
  const name = hit.name.toUpperCase();
  if (symbol === needle) return 0;
  if (symbol.startsWith(needle)) return 1;
  if (name.startsWith(needle)) return 2;
  if (symbol.includes(needle)) return 3;
  if (name.includes(needle)) return 4;
  return 99;
}

export function filterSearchUniverse(
  universe: SearchInstrument[],
  query: string,
  limit = 20,
): SearchInstrument[] {
  const needle = query.trim().toUpperCase();
  const wantsOptions = /\b(OPT|OPTION|CE|PE)\b/.test(needle) || needle.length >= 8;
  const pool = wantsOptions ? universe : universe.filter((hit) => hit.kind !== "option" || INDEX_INSTRUMENTS.some((i) => i.underlying === hit.symbol));
  if (!needle) {
    return pool.filter((hit) => hit.kind !== "option").slice(0, 12);
  }
  const ranked = pool
    .map((hit) => ({ hit, score: scoreHit(hit, needle) }))
    .filter((row) => row.score < 99)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      const kindRank = { index: 0, stock: 1, future: 2, option: 3 };
      return kindRank[a.hit.kind] - kindRank[b.hit.kind] || a.hit.symbol.localeCompare(b.hit.symbol);
    })
    .map((row) => row.hit);

  const underlyings = INDEX_INSTRUMENTS.filter(
    (i) =>
      i.label.includes(needle) ||
      i.underlying.includes(needle) ||
      i.spotSymbol.includes(needle),
  ).map((i) => ({
    symbol: i.underlying,
    name: `${i.label} options / futures`,
    kind: "option" as const,
    exchange: "NFO",
    href: `/options/${encodeURIComponent(i.underlying)}`,
  }));

  const merged: SearchInstrument[] = [];
  for (const hit of [...ranked, ...underlyings]) pushUnique(merged, hit);
  return merged.slice(0, limit);
}

export function groupSearchHits(hits: SearchInstrument[]): { kind: InstrumentKind; label: string; hits: SearchInstrument[] }[] {
  const order: InstrumentKind[] = ["index", "stock", "future", "option"];
  return order
    .map((kind) => ({
      kind,
      label: kind === "index" ? "INDICES" : kind === "stock" ? "STOCKS" : kind === "future" ? "FUTURES" : "OPTIONS",
      hits: hits.filter((h) => h.kind === kind),
    }))
    .filter((g) => g.hits.length > 0);
}

export function destinationForHit(hit: SearchInstrument): string {
  if (hit.kind === "option") {
    const und = underlyingForSymbol(hit.symbol);
    return `/options/${encodeURIComponent(und)}`;
  }
  return hit.href;
}
