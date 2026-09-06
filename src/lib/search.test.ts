import { describe, expect, it } from "vitest";
import { buildSearchUniverse, filterSearchUniverse } from "@/lib/search";

describe("search autocomplete", () => {
  const universe = buildSearchUniverse(
    ["NIFTY 50", "NIFTY BANK", "RELIANCE", "HDFCBANK", "INFY"],
    [
      { symbol: "HDFCBANK", found: true, quote: { symbol: "HDFCBANK", timestamp: null, last_price: null, change: null, change_pct: null, volume: null, volume_delta: null, oi: null, oi_change: null, oi_change_pct: null, last_quantity: null, average_price: null, best_bid: null, best_ask: null, best_bid_quantity: null, best_ask_quantity: null, spread: null, mid_price: null, buy_quantity: null, sell_quantity: null, displayed_bid_quantity: null, displayed_ask_quantity: null, bid_depth_5: null, ask_depth_5: null, depth_imbalance: null, ohlc: null, instrument_type: "EQ", exchange: "NSE" } },
      { symbol: "RELIANCE", found: true, quote: { symbol: "RELIANCE", timestamp: null, last_price: null, change: null, change_pct: null, volume: null, volume_delta: null, oi: null, oi_change: null, oi_change_pct: null, last_quantity: null, average_price: null, best_bid: null, best_ask: null, best_bid_quantity: null, best_ask_quantity: null, spread: null, mid_price: null, buy_quantity: null, sell_quantity: null, displayed_bid_quantity: null, displayed_ask_quantity: null, bid_depth_5: null, ask_depth_5: null, depth_imbalance: null, ohlc: null, instrument_type: "EQ", exchange: "NSE" } },
    ],
  );

  it("does not invent the typed prefix as a symbol", () => {
    const hits = filterSearchUniverse(universe, "HD");
    expect(hits.map((h) => h.symbol)).toContain("HDFCBANK");
    expect(hits.map((h) => h.symbol)).not.toContain("HD");
  });

  it("matches REL to RELIANCE", () => {
    const hits = filterSearchUniverse(universe, "REL");
    expect(hits[0]?.symbol).toBe("RELIANCE");
  });

  it("matches NIFT to index underlyings without dumping option contracts", () => {
    const hits = filterSearchUniverse(universe, "NIFT");
    const symbols = hits.map((h) => h.symbol);
    expect(symbols).toContain("NIFTY 50");
    expect(symbols).toContain("NIFTY BANK");
    expect(symbols).toContain("NIFTY");
    expect(symbols.some((s) => /CE$|PE$/.test(s))).toBe(false);
  });

  it("does not invent NIFTY 100", () => {
    const hits = filterSearchUniverse(universe, "NIFT");
    expect(hits.map((h) => h.symbol)).not.toContain("NIFTY 100");
  });
});
