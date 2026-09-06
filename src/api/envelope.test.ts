import { describe, expect, it } from "vitest";
import {
  EnvelopeError,
  assertNoFabricatedProbability,
  chainStatusLabel,
  maturityViews,
  parseEnvelope,
  probabilityCell,
} from "@/api/envelope";

const suppressed = {
  equity: {
    tier: "suppressed",
    pooled_live_days: 2,
    threshold_days: 60,
    display: "insufficient data, 2/60 pooled days",
    probability_permitted: false,
    probability: null,
  },
};

describe("envelope parsing", () => {
  it("requires maturity", () => {
    expect(() => parseEnvelope({ as_of: "x" })).toThrow(EnvelopeError);
  });

  it("preserves null data fields", () => {
    const payload = parseEnvelope<{ found: boolean; quote: null }>({
      maturity: suppressed,
      as_of: "2026-09-04T00:00:00+00:00",
      found: false,
      quote: null,
    });
    expect(payload.quote).toBeNull();
    expect(payload.found).toBe(false);
    expect(payload.maturity.equity.probability).toBeNull();
  });

  it("does not coerce missing PCR to zero", () => {
    const payload = parseEnvelope<{ chain: { pcr_oi: null } }>({
      maturity: suppressed,
      as_of: null,
      chain: { pcr_oi: null },
    });
    expect(payload.chain.pcr_oi).toBeNull();
  });
});

describe("maturity / probability", () => {
  it("shows N/60 instead of a number when gated", () => {
    const cell = probabilityCell({
      probability: 0.62,
      probability_permitted: false,
      display: "insufficient data, 2/60 pooled days",
    });
    expect(cell).toBe("insufficient data, 2/60 pooled days");
    expect(cell).not.toContain("0.62");
    expect(cell).not.toContain("0.00");
  });

  it("rejects fabricated probability on suppressed views", () => {
    expect(() =>
      assertNoFabricatedProbability({
        equity: { ...suppressed.equity, probability: 0.5 },
      }),
    ).toThrow();
    expect(() => assertNoFabricatedProbability(suppressed)).not.toThrow();
  });
});

describe("maturityViews keys", () => {
  it("keeps unique envelope keys when both option classes share class_key", () => {
    const views = maturityViews({
      options_nifty: {
        class_key: "options",
        underlying: "NIFTY",
        display: "insufficient data",
        probability_permitted: false,
      },
      options_banknifty: {
        class_key: "options",
        underlying: "BANKNIFTY",
        display: "insufficient data",
        probability_permitted: false,
      },
    });
    const keys = views.map((v) => v.envelope_key);
    expect(keys).toEqual(["options_nifty", "options_banknifty"]);
    expect(new Set(keys).size).toBe(2);
    expect(views.every((v) => v.class_key === "options")).toBe(true);
  });
});

describe("chain_status", () => {
  it("labels truncated as subscription limit", () => {
    expect(chainStatusLabel("truncated", true)).toBe("Partial chain — subscription limit");
  });
  it("labels partial without implying completeness", () => {
    expect(chainStatusLabel("partial")).toBe("Partial option chain");
  });
  it("does not invent a status", () => {
    expect(chainStatusLabel(null)).toBe("N/A");
  });
});
