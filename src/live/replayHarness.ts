/**
 * Deterministic SSE replay. Fixtures only — never production market data.
 * No SharedWorker, MarketCache, Zustand, or terminal UI.
 */

export type ReplayFrame = {
  event: string;
  data: Record<string, unknown>;
  id?: number | string | null;
};

export type IntegrityReport = {
  kind: "replay_fixture";
  total_frames: number;
  by_event: Record<string, number>;
  duplicate_count: number;
  gap_count: number;
  out_of_order_count: number;
  regression_count: number;
  reconnect_count: number;
  resyncs: Record<string, unknown>[];
};

const REQUIRED = [
  "normal_ordered",
  "duplicate_frame",
  "out_of_order",
  "sequence_gap",
  "reconnect",
  "ingestion_restart",
  "stale_data",
  "partial_session",
] as const;

export type ScenarioName = (typeof REQUIRED)[number];

function tick(seq: number, ltp: number): ReplayFrame {
  return {
    event: "tick",
    id: seq,
    data: { t: 1, ts: "2026-09-09T04:00:00+00:00", seq, ltp },
  };
}

export function scenarioEvents(name: ScenarioName): ReplayFrame[] {
  const hello: ReplayFrame = {
    event: "hello",
    data: {
      connection_id: "replay",
      session: { market_state: "open", session_date: "2026-09-09" },
    },
  };
  switch (name) {
    case "normal_ordered":
      return [hello, tick(1, 100), tick(2, 101), tick(3, 102)];
    case "duplicate_frame":
      return [hello, tick(1, 100), tick(1, 100)];
    case "out_of_order":
      return [hello, tick(2, 101), tick(1, 100)];
    case "sequence_gap":
      return [hello, tick(1, 100), tick(4, 104)];
    case "reconnect":
      return [
        hello,
        tick(1, 100),
        { event: "hello", data: { connection_id: "replay-2" } },
        { event: "resync", data: { reason: "unavailable_continuity", from_seq: 3 } },
        tick(1, 101),
      ];
    case "ingestion_restart":
      return [
        hello,
        tick(1, 100),
        { event: "resync", data: { reason: "ingestion_restart", from_seq: 5 } },
        tick(1, 101),
      ];
    case "stale_data":
      return [
        hello,
        tick(1, 100),
        {
          event: "session",
          data: { market_state: "open", data_status: "stale", coverage: null },
        },
      ];
    case "partial_session":
      return [
        hello,
        {
          event: "session",
          data: {
            market_state: "open",
            data_status: "live",
            coverage: "PARTIAL_SESSION",
          },
        },
        tick(1, 100),
      ];
    default:
      throw new Error(name);
  }
}

export function play(frames: ReplayFrame[]): IntegrityReport {
  const byEvent: Record<string, number> = {};
  const resyncs: Record<string, unknown>[] = [];
  const seen = new Set<number>();
  let lastSeq: number | null = null;
  let duplicates = 0;
  let gaps = 0;
  let outOfOrder = 0;
  let regressions = 0;
  let reconnects = 0;
  let lastTs = "";
  for (const frame of frames) {
    byEvent[frame.event] = (byEvent[frame.event] || 0) + 1;
    if (frame.event === "hello") reconnects += 1;
    if (frame.event === "resync") {
      resyncs.push(frame.data);
      lastSeq = null;
      seen.clear();
      continue;
    }
    if (frame.event !== "tick") continue;
    const seq = Number(frame.id ?? frame.data.seq);
    if (!Number.isFinite(seq)) continue;
    if (seen.has(seq)) duplicates += 1;
    seen.add(seq);
    if (lastSeq !== null) {
      if (seq < lastSeq) outOfOrder += 1;
      else if (seq > lastSeq + 1) gaps += 1;
    }
    lastSeq = seq;
    const ts = String(frame.data.ts || "");
    if (lastTs && ts && ts < lastTs) regressions += 1;
    lastTs = ts || lastTs;
  }
  return {
    kind: "replay_fixture",
    total_frames: frames.length,
    by_event: byEvent,
    duplicate_count: duplicates,
    gap_count: gaps,
    out_of_order_count: outOfOrder,
    regression_count: regressions,
    reconnect_count: reconnects,
    resyncs,
  };
}

export function playScenario(name: ScenarioName): IntegrityReport {
  return play(scenarioEvents(name));
}

export const REQUIRED_SCENARIOS = REQUIRED;
