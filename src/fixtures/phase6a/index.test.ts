import { describe, expect, it } from "vitest";
import {
  PHASE6A_ACTIVITY,
  PHASE6A_DEFAULT_INSTRUMENT,
  PHASE6A_INDEX_STRIP,
  PHASE6A_MARKETWATCH,
  phase6aCoreSnapshot,
  phase6aFutures,
  phase6aIntelligence,
  phase6aOptions,
} from "@/fixtures/phase6a";
import { PHASE6A_SOURCE } from "@/terminal/types";

describe("Phase 6A fixture boundary", () => {
  it("marks every presentation snapshot as a UI fixture", () => {
    expect(PHASE6A_MARKETWATCH).toHaveLength(19);
    expect(PHASE6A_MARKETWATCH.every((row) => row.source === PHASE6A_SOURCE)).toBe(true);
    expect(PHASE6A_INDEX_STRIP.every((row) => row.source === PHASE6A_SOURCE)).toBe(true);
    expect(PHASE6A_ACTIVITY.source).toBe(PHASE6A_SOURCE);
    expect(PHASE6A_ACTIVITY.events.every((row) => row.source === PHASE6A_SOURCE)).toBe(true);

    const core = phase6aCoreSnapshot(PHASE6A_DEFAULT_INSTRUMENT);
    const options = phase6aOptions(core.ltp);
    const futures = phase6aFutures(PHASE6A_DEFAULT_INSTRUMENT.symbol, core.ltp);
    const intel = phase6aIntelligence(PHASE6A_DEFAULT_INSTRUMENT);

    expect(core.source).toBe(PHASE6A_SOURCE);
    expect(options.source).toBe(PHASE6A_SOURCE);
    expect(options.rows.every((row) => row.source === PHASE6A_SOURCE)).toBe(true);
    expect(futures.source).toBe(PHASE6A_SOURCE);
    expect(futures.rows.every((row) => row.source === PHASE6A_SOURCE)).toBe(true);
    expect(intel.source).toBe(PHASE6A_SOURCE);
    expect(intel.probability).toBeNull();
    expect(intel.probabilityReason).toMatch(/insufficient history/i);
  });
});
