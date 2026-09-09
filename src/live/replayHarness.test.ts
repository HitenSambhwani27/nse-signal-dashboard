import { describe, expect, it } from "vitest";
import {
  REQUIRED_SCENARIOS,
  playScenario,
} from "./replayHarness";

describe("Phase 5 replay harness", () => {
  it("covers the required scenarios", () => {
    expect([...REQUIRED_SCENARIOS]).toEqual([
      "normal_ordered",
      "duplicate_frame",
      "out_of_order",
      "sequence_gap",
      "reconnect",
      "ingestion_restart",
      "stale_data",
      "partial_session",
    ]);
  });

  it("detects ordered, duplicate, gap, and out-of-order frames", () => {
    expect(playScenario("normal_ordered").duplicate_count).toBe(0);
    expect(playScenario("normal_ordered").gap_count).toBe(0);
    expect(playScenario("duplicate_frame").duplicate_count).toBe(1);
    expect(playScenario("sequence_gap").gap_count).toBe(1);
    expect(playScenario("out_of_order").out_of_order_count).toBe(1);
  });

  it("records reconnect and ingestion-restart resync reasons", () => {
    const reconnect = playScenario("reconnect");
    expect(reconnect.resyncs.some((r) => r.reason === "unavailable_continuity")).toBe(
      true,
    );
    const restart = playScenario("ingestion_restart");
    expect(restart.resyncs.some((r) => r.reason === "ingestion_restart")).toBe(true);
  });

  it("keeps stale and partial-session fixtures distinct from live ticks", () => {
    expect(playScenario("stale_data").by_event.session).toBe(1);
    expect(playScenario("partial_session").by_event.session).toBe(1);
    expect(playScenario("stale_data").kind).toBe("replay_fixture");
  });
});
