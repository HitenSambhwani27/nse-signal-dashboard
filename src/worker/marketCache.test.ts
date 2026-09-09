import { beforeEach, describe, expect, it } from "vitest";
import { MarketCache, decodeSession, type QuoteSnapshot } from "@/worker/marketCache";

const TOKEN = 341249;

function snapshot(partial: Partial<QuoteSnapshot> = {}): QuoteSnapshot {
  return {
    token: TOKEN,
    meta: {
      symbol: "HDFCBANK",
      exchange: "NSE",
      instrumentType: "EQ",
      lotSize: 1,
      tickSize: 0.05,
    },
    ltp: 727,
    change: 0,
    changePct: 0,
    volume: 60427,
    oi: 0,
    bid: null,
    ask: null,
    timestamp: "2026-08-14T09:44:00+00:00",
    ...partial,
  };
}

describe("MarketCache subscriptions", () => {
  let cache: MarketCache;
  beforeEach(() => {
    cache = new MarketCache();
  });

  it("reference counts so two consumers of one instrument are one token", () => {
    cache.retain([TOKEN]);
    cache.retain([TOKEN]);
    expect(cache.refCount(TOKEN)).toBe(2);
    expect(cache.subscribedTokens()).toEqual([TOKEN]);

    cache.release([TOKEN]);
    expect(cache.refCount(TOKEN)).toBe(1);
    expect(cache.get(TOKEN)).toBeDefined();

    cache.release([TOKEN]);
    expect(cache.refCount(TOKEN)).toBe(0);
    expect(cache.get(TOKEN)).toBeUndefined();
  });
});

describe("MarketCache.applyTick", () => {
  let cache: MarketCache;
  beforeEach(() => {
    cache = new MarketCache();
    cache.retain([TOKEN]);
    cache.drainDirty();
  });

  it("maps Phase 5 abbreviations, including bb/ba as best bid/ask price", () => {
    const result = cache.applyTick(
      { t: TOKEN, seq: 1, ts: "2026-08-14T09:44:00+00:00", ltp: 727.5, chgp: 0.4, vol: 100, bb: 727.4, ba: 727.6 },
      1_000,
    );
    expect(result).toEqual({ changed: true, dropped: null });
    const state = cache.get(TOKEN);
    expect(state?.ltp).toBe(727.5);
    expect(state?.changePct).toBe(0.4);
    expect(state?.bid).toBe(727.4);
    expect(state?.ask).toBe(727.6);
    expect(state?.origin).toBe("stream");
  });

  it("treats an absent field as unchanged, not as zero", () => {
    cache.applyTick({ t: TOKEN, seq: 1, ltp: 727.5, vol: 100 }, 1_000);
    cache.applyTick({ t: TOKEN, seq: 2, ltp: 728 }, 2_000);
    const state = cache.get(TOKEN);
    expect(state?.ltp).toBe(728);
    expect(state?.volume).toBe(100);
  });

  it("drops duplicate and out-of-order sequences", () => {
    cache.applyTick({ t: TOKEN, seq: 5, ltp: 100 }, 1_000);
    expect(cache.applyTick({ t: TOKEN, seq: 5, ltp: 999 }, 1_100).dropped).toBe("duplicate");
    expect(cache.applyTick({ t: TOKEN, seq: 4, ltp: 999 }, 1_200).dropped).toBe("out_of_order");
    expect(cache.get(TOKEN)?.ltp).toBe(100);
  });

  it("ignores ticks for tokens nobody subscribed to", () => {
    expect(cache.applyTick({ t: 999, seq: 1, ltp: 1 }, 1_000).dropped).toBe("unknown_token");
  });

  it("survives malformed payloads without poisoning the cache", () => {
    expect(cache.applyTick(null, 1_000).dropped).toBe("malformed");
    expect(cache.applyTick({ seq: 1 }, 1_000).dropped).toBe("malformed");
    cache.applyTick({ t: TOKEN, seq: 1, ltp: 100 }, 1_000);
    cache.applyTick({ t: TOKEN, seq: 2, ltp: "not-a-number" }, 2_000);
    expect(cache.get(TOKEN)?.ltp).toBe(100);
  });

  it("accepts an explicit null as an observed absence", () => {
    cache.applyTick({ t: TOKEN, seq: 1, oi: 500 }, 1_000);
    cache.applyTick({ t: TOKEN, seq: 2, oi: null }, 2_000);
    expect(cache.get(TOKEN)?.oi).toBeNull();
  });

  it("reports only genuinely changed instruments as dirty", () => {
    cache.applyTick({ t: TOKEN, seq: 1, ltp: 100 }, 1_000);
    expect(cache.drainDirty()).toHaveLength(1);
    expect(cache.applyTick({ t: TOKEN, seq: 2, ltp: 100 }, 2_000).changed).toBe(false);
    expect(cache.drainDirty()).toHaveLength(0);
  });
});

describe("MarketCache hydration and continuity", () => {
  let cache: MarketCache;
  beforeEach(() => {
    cache = new MarketCache();
    cache.retain([TOKEN]);
  });

  it("seeds state from REST when no tick has arrived", () => {
    expect(cache.hydrate(snapshot(), 1_000)).toBe(true);
    const state = cache.get(TOKEN);
    expect(state?.ltp).toBe(727);
    expect(state?.origin).toBe("snapshot");
    expect(state?.meta.symbol).toBe("HDFCBANK");
  });

  it("does not let a REST snapshot overwrite a live stream value", () => {
    cache.applyTick({ t: TOKEN, seq: 1, ltp: 800 }, 2_000);
    cache.hydrate(snapshot({ ltp: 727 }), 3_000);
    const state = cache.get(TOKEN);
    expect(state?.ltp).toBe(800);
    expect(state?.meta.symbol).toBe("HDFCBANK");
  });

  it("clears sequence guards so a restarted server's seq is not rejected", () => {
    cache.applyTick({ t: TOKEN, seq: 900, ltp: 100 }, 1_000);
    expect(cache.resetSequenceGuards()).toEqual([TOKEN]);
    expect(cache.applyTick({ t: TOKEN, seq: 1, ltp: 200 }, 2_000).changed).toBe(true);
    expect(cache.get(TOKEN)?.ltp).toBe(200);
  });

  it("clears session-cumulative fields on a session date rollover", () => {
    cache.applyTick({ t: TOKEN, seq: 1, ltp: 100, vol: 5_000, oi: 900, chgp: 1.2 }, 1_000);
    cache.setSession(session("2026-08-14"));
    cache.setSession(session("2026-08-17"));
    const state = cache.get(TOKEN);
    expect(state?.volume).toBeNull();
    expect(state?.oi).toBeNull();
    expect(state?.changePct).toBeNull();
    expect(state?.ltp).toBe(100);
  });

  it("does not report an unchanged session as a change", () => {
    cache.setSession(session("2026-08-14"));
    expect(cache.setSession(session("2026-08-14"))).toBe(false);
  });
});

describe("decodeSession", () => {
  it("keeps PARTIAL_SESSION and rejects any other coverage label", () => {
    expect(decodeSession({ coverage: "PARTIAL_SESSION" })?.coverage).toBe("PARTIAL_SESSION");
    expect(decodeSession({ coverage: "FULL_SESSION" })?.coverage).toBeNull();
  });

  it("falls back to unknown for an unrecognised market state", () => {
    expect(decodeSession({ market_state: "moon" })?.marketState).toBe("unknown");
    expect(decodeSession({ market_state: "open" })?.marketState).toBe("open");
  });

  it("preserves the stream's null data_status rather than inventing one", () => {
    expect(decodeSession({ market_state: "open" })?.dataStatus).toBeNull();
  });
});

function session(date: string) {
  return {
    marketState: "open" as const,
    sessionDate: date,
    coverage: null,
    dataStatus: null,
    liveDataExpected: true,
    asOf: null,
  };
}
