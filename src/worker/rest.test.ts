import { afterEach, describe, expect, it, vi } from "vitest";
import type { Quote } from "@/api/types";
import { fetchCandles, quoteToSnapshot } from "@/worker/rest";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCandles", () => {
  it("maps a real RM-1 /candles envelope onto bars instead of treating it as empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          found: true,
          candles_status: "complete",
          candles_reason: null,
          candles_source: "bars_1m",
          interval: "5m",
          data_state: {
            market_state: "closed",
            data_status: "last_session",
            as_of: "2026-08-14T15:29:00+05:30",
            reason: "market_closed",
          },
          candles: [
            {
              timestamp: "2026-08-14T03:45:00+00:00",
              t: "2026-08-14T03:45:00+00:00",
              open: 24600,
              high: 24620,
              low: 24590,
              close: 24610,
              volume: 1200,
              o: 24600,
              h: 24620,
              l: 24590,
              c: 24610,
              v: 1200,
              complete: true,
            },
          ],
        }),
      }),
    );

    const result = await fetchCandles("NIFTY 50", "5m");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/api/v1/candles/NIFTY%2050?interval=5m",
    );
    expect(result.status).toBe("ok");
    expect(result.data?.source).toBe("bars_1m");
    expect(result.data?.bars).toHaveLength(1);
    expect(result.data?.bars[0]).toMatchObject({
      time: Date.parse("2026-08-14T03:45:00+00:00") / 1000,
      open: 24600,
      high: 24620,
      low: 24590,
      close: 24610,
      volume: 1200,
    });
  });

  it("preserves bars_not_built when the RM-1 store is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          found: false,
          candles: [],
          candles_status: "unavailable",
          candles_reason: "bars_not_built",
          candles_source: null,
          interval: "5m",
          data_state: { reason: "no_live_or_historical_observation" },
        }),
      }),
    );

    const result = await fetchCandles("NIFTY 50", "5m");
    expect(result.status).toBe("unavailable");
    expect(result.reason).toBe("bars_not_built");
    expect(result.data?.bars).toEqual([]);
  });
});

function baseQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: "RELIANCE",
    instrument_token: 738561,
    exchange: "NSE",
    timestamp: "2026-08-14T09:44:00+00:00",
    last_price: 1308.7,
    change: -0.2,
    change_pct: -0.01528,
    volume: 109342,
    volume_delta: null,
    oi: 0,
    oi_change: null,
    oi_change_pct: null,
    last_quantity: 0,
    average_price: null,
    best_bid: null,
    best_ask: null,
    best_bid_quantity: null,
    best_ask_quantity: null,
    spread: null,
    mid_price: null,
    buy_quantity: null,
    sell_quantity: null,
    displayed_bid_quantity: null,
    displayed_ask_quantity: null,
    bid_depth_5: null,
    ask_depth_5: null,
    depth_imbalance: null,
    ohlc: null,
    instrument_type: "EQ",
    missing_fields: ["depth"],
    ...overrides,
  };
}

describe("quoteToSnapshot", () => {
  it("prefers canonical change_absolute / change_percent over legacy fields", () => {
    const snapshot = quoteToSnapshot(
      baseQuote({
        change: -0.2,
        change_pct: -0.01528,
        change_absolute: 0,
        change_percent: 0,
      }),
    );
    expect(snapshot?.change).toBe(0);
    expect(snapshot?.changePct).toBe(0);
  });

  it("falls back to legacy change fields only when canonical keys are absent", () => {
    const snapshot = quoteToSnapshot(baseQuote());
    expect(snapshot?.change).toBe(-0.2);
    expect(snapshot?.changePct).toBe(-0.01528);
  });

  it("does not fall back to legacy when canonical fields are present and null", () => {
    const snapshot = quoteToSnapshot(
      baseQuote({
        change: -0.2,
        change_pct: -0.01528,
        change_absolute: null,
        change_percent: null,
      }),
    );
    expect(snapshot?.change).toBeNull();
    expect(snapshot?.changePct).toBeNull();
  });

  it("keeps a genuine numeric zero that is not listed in missing_fields", () => {
    const snapshot = quoteToSnapshot(
      baseQuote({
        volume: 0,
        oi: 0,
        missing_fields: ["depth"],
      }),
    );
    expect(snapshot?.volume).toBe(0);
    expect(snapshot?.oi).toBe(0);
  });

  it("treats a listed missing_fields volume as unavailable even when the slot is 0", () => {
    const snapshot = quoteToSnapshot(
      baseQuote({
        volume: 0,
        missing_fields: ["depth", "volume"],
      }),
    );
    expect(snapshot?.volume).toBeNull();
    expect(snapshot?.oi).toBe(0);
  });

  it("treats listed missing oi as unavailable and does not assume equity OI=0 is missing", () => {
    const equityZero = quoteToSnapshot(baseQuote({ oi: 0, missing_fields: ["depth"] }));
    expect(equityZero?.oi).toBe(0);
    const listedMissing = quoteToSnapshot(baseQuote({ oi: 0, missing_fields: ["depth", "oi"] }));
    expect(listedMissing?.oi).toBeNull();
    const explicitNull = quoteToSnapshot(baseQuote({ oi: null, missing_fields: ["depth"] }));
    expect(explicitNull?.oi).toBeNull();
  });

  it("keeps a non-zero volume and nulls bid/ask when depth is missing", () => {
    const snapshot = quoteToSnapshot(
      baseQuote({
        volume: 60427,
        best_bid: 0,
        best_ask: 0,
        missing_fields: ["depth"],
      }),
    );
    expect(snapshot?.volume).toBe(60427);
    expect(snapshot?.bid).toBeNull();
    expect(snapshot?.ask).toBeNull();
  });
});
