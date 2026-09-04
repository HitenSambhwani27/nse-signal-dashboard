import { describe, expect, it } from "vitest";
import {
  DASH,
  formatCompactIndian,
  formatInr,
  formatInsufficient,
  formatPct,
  formatRatioPct,
} from "@/lib/format";
import { classifyFreshness, marketStatus } from "@/lib/freshness";
import { extractCandles } from "@/lib/candles";
import { symbolHref } from "@/lib/instruments";

describe("number formatting", () => {
  it("formats INR and preserves null", () => {
    expect(formatInr(2543.5)).toBe("₹2,543.50");
    expect(formatInr(null)).toBe(DASH);
    expect(formatInr(undefined)).toBe(DASH);
  });

  it("formats compact Indian quantities", () => {
    expect(formatCompactIndian(1_240_000)).toBe("12.40L");
    expect(formatCompactIndian(23_100_000)).toBe("2.31Cr");
    expect(formatCompactIndian(null)).toBe(DASH);
  });

  it("formats percents without turning null into 0", () => {
    expect(formatPct(1.42)).toBe("+1.42%");
    expect(formatPct(null)).toBe(DASH);
    expect(formatRatioPct(0.0142)).toBe("+1.42%");
    expect(formatRatioPct(null)).toBe(DASH);
  });

  it("formats maturity copy", () => {
    expect(formatInsufficient(2)).toBe("Insufficient data, 2/60 pooled days");
  });
});

describe("stale / market closed", () => {
  it("marks old timestamps stale", () => {
    const asOf = new Date(Date.now() - 3600_000).toISOString();
    expect(classifyFreshness(asOf).level).toBe("stale");
    expect(classifyFreshness(asOf).label).toBe("Data is stale");
  });

  it("does not fake LIVE when missing", () => {
    const closedSunday = new Date("2026-09-06T04:00:00+00:00");
    const status = marketStatus({ asOf: null, found: false, now: closedSunday });
    expect(status.label).not.toMatch(/live/i);
    expect(["Market closed", "Awaiting market data", "No live data"]).toContain(status.label);
  });
});

describe("candles", () => {
  it("does not synthesise OHLC from last_price", () => {
    const candles = extractCandles({
      points: [
        { timestamp: "2026-09-04T10:00:00+00:00", last_price: 100, volume: 1 },
        { timestamp: "2026-09-04T10:01:00+00:00", last_price: 101, volume: 2 },
      ],
      observation_count: 2,
      returned_points: 2,
      downsampled: false,
    });
    expect(candles).toBeNull();
  });

  it("accepts backend OHLC when present", () => {
    const candles = extractCandles({
      points: [
        {
          timestamp: "2026-09-04T10:00:00+00:00",
          open: 100,
          high: 102,
          low: 99,
          close: 101,
        },
      ],
      observation_count: 1,
      returned_points: 1,
      downsampled: false,
    });
    expect(candles).toHaveLength(1);
    expect(candles?.[0].close).toBe(101);
  });
});

describe("routes", () => {
  it("encodes symbol paths", () => {
    expect(symbolHref("NIFTY 50")).toBe("/symbol/NIFTY%2050");
    expect(symbolHref("HDFCBANK", "options")).toBe("/symbol/HDFCBANK/options");
  });
});
