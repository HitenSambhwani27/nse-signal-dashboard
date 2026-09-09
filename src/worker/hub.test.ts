import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  STALE_HEARTBEAT_MULTIPLIER,
  StreamHub,
  type HubConnection,
  type HubRest,
  type PortLike,
} from "@/worker/hub";
import type { QuoteSnapshot } from "@/worker/marketCache";
import type { RestResult } from "@/worker/rest";
import type { SseFrame } from "@/worker/sse";
import type { WorkerMessage } from "@/worker/protocol";

const HDFC = 341249;
const INFY = 408065;

/* ---------------- harness ---------------- */

class FakeClock {
  now = 0;
  private handle = 1;
  private readonly queue = new Map<number, { at: number; fn: () => void }>();

  setTimer = (fn: () => void, ms: number): number => {
    const id = this.handle++;
    this.queue.set(id, { at: this.now + ms, fn });
    return id;
  };

  clearTimer = (id: number): void => {
    this.queue.delete(id);
  };

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.queue.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, task] = due;
      this.queue.delete(id);
      this.now = task.at;
      task.fn();
    }
    this.now = target;
  }
}

class FakePort implements PortLike {
  readonly messages: WorkerMessage[] = [];
  postMessage(message: WorkerMessage): void {
    this.messages.push(message);
  }
  ofType<T extends WorkerMessage["type"]>(type: T): Extract<WorkerMessage, { type: T }>[] {
    return this.messages.filter(
      (m): m is Extract<WorkerMessage, { type: T }> => m.type === type,
    );
  }
  last<T extends WorkerMessage["type"]>(type: T): Extract<WorkerMessage, { type: T }> | undefined {
    const all = this.ofType(type);
    return all[all.length - 1];
  }
}

class FakeConnection implements HubConnection {
  started = 0;
  stopped = 0;
  readonly tokenSets: number[][] = [];
  private lastEventId: string | null = null;
  start(): void {
    this.started += 1;
  }
  stop(): void {
    this.stopped += 1;
  }
  setTokens(tokens: number[]): void {
    this.tokenSets.push([...tokens]);
  }
  getLastEventId(): string | null {
    return this.lastEventId;
  }
}

function quote(token: number, symbol: string, ltp: number): RestResult<QuoteSnapshot> {
  return {
    status: "ok",
    dataStatus: "last_session",
    marketState: "post_close",
    asOf: "2026-08-14T15:29:00+05:30",
    reason: null,
    data: {
      token,
      meta: { symbol, exchange: "NSE", instrumentType: "EQ", lotSize: 1, tickSize: 0.05 },
      ltp,
      change: 0,
      changePct: 0,
      volume: 1_000,
      oi: null,
      bid: null,
      ask: null,
      timestamp: "2026-08-14T09:44:00+00:00",
    },
  };
}

function unavailable<T>(reason: string): RestResult<T> {
  return {
    status: "unavailable",
    data: null,
    dataStatus: "no_data",
    marketState: "post_close",
    asOf: null,
    reason,
  };
}

interface Harness {
  hub: StreamHub;
  clock: FakeClock;
  rest: HubRest;
  connections: FakeConnection[];
  quoteCalls: string[];
}

function harness(): Harness {
  const clock = new FakeClock();
  const connections: FakeConnection[] = [];
  const quoteCalls: string[] = [];
  const symbols: Record<string, [number, number]> = {
    HDFCBANK: [HDFC, 727],
    INFY: [INFY, 1169.2],
  };
  const rest: HubRest = {
    fetchQuoteSnapshot: vi.fn(async (symbol: string) => {
      quoteCalls.push(symbol);
      const found = symbols[symbol];
      return found ? quote(found[0], symbol, found[1]) : unavailable<QuoteSnapshot>("not_found");
    }),
    fetchOptionChain: vi.fn(async () => unavailable("bars")),
    fetchFuturesBook: vi.fn(async () => unavailable("no_data")),
    fetchUnusualActivity: vi.fn(async () => unavailable("no_rows")),
    fetchCandles: vi.fn(async () => unavailable("bars_not_built")),
  } as unknown as HubRest;

  const hub = new StreamHub(
    {
      now: () => clock.now,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
      rest,
      workerId: "test-worker",
    },
    () => {
      const connection = new FakeConnection();
      connections.push(connection);
      return connection;
    },
  );
  return { hub, clock, rest, connections, quoteCalls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function helloFrame(heartbeatMs = 5_000): SseFrame {
  return {
    event: "hello",
    id: null,
    retryMs: null,
    data: JSON.stringify({
      connection_id: "conn-1",
      heartbeat_ms: heartbeatMs,
      max_instruments: 250,
      schema_version: "1",
      subscribed: [HDFC],
      rejected: [],
      session: { market_state: "open", session_date: "2026-09-09", coverage: null },
    }),
  };
}

function tickFrame(seq: number, token: number, ltp: number): SseFrame {
  return {
    event: "tick",
    id: String(seq),
    retryMs: null,
    data: JSON.stringify({ t: token, seq, ts: "2026-09-09T04:00:00+00:00", ltp }),
  };
}

/* ---------------- tests ---------------- */

describe("StreamHub ports", () => {
  let h: Harness;
  beforeEach(() => {
    h = harness();
  });

  it("greets a new port with readiness and the current snapshot", () => {
    const port = new FakePort();
    h.hub.attach(port);
    expect(port.ofType("worker_ready")).toHaveLength(1);
    const snapshot = port.last("snapshot");
    expect(snapshot?.instruments).toEqual([]);
    expect(snapshot?.health.status).toBe("idle");
  });

  it("rejects an unrecognised client message without throwing", () => {
    const port = new FakePort();
    const id = h.hub.attach(port);
    h.hub.handleMessage(id, { type: "nonsense" });
    expect(port.last("worker_error")?.message).toBe("unrecognised_client_message");
  });

  it("reaps a port that stops pinging", () => {
    const port = new FakePort();
    const id = h.hub.attach(port);
    h.hub.handleMessage(id, { type: "subscribe", consumer: "row", tokens: [HDFC] });
    expect(h.hub.portCount()).toBe(1);
    h.clock.advance(61_000);
    expect(h.hub.portCount()).toBe(0);
    expect(h.connections[0].stopped).toBe(1);
  });
});

describe("StreamHub subscriptions", () => {
  let h: Harness;
  beforeEach(() => {
    h = harness();
  });

  it("deduplicates one instrument shared by two consumers into one upstream token", () => {
    const marketwatch = new FakePort();
    const core = new FakePort();
    const a = h.hub.attach(marketwatch);
    const b = h.hub.attach(core);

    h.hub.handleMessage(a, { type: "subscribe", consumer: "marketwatch", tokens: [HDFC] });
    h.hub.handleMessage(b, { type: "subscribe", consumer: "core", tokens: [HDFC] });

    expect(h.connections).toHaveLength(1);
    expect(h.connections[0].tokenSets.at(-1)).toEqual([HDFC]);
    expect(h.hub.getCache().refCount(HDFC)).toBe(2);

    h.hub.handleMessage(b, { type: "unsubscribe", consumer: "core", tokens: [HDFC] });
    expect(h.hub.getCache().refCount(HDFC)).toBe(1);
    expect(h.connections[0].tokenSets.at(-1)).toEqual([HDFC]);
  });

  it("releases a departed port's tokens without touching another port's", () => {
    const a = h.hub.attach(new FakePort());
    const b = h.hub.attach(new FakePort());
    h.hub.handleMessage(a, { type: "subscribe", consumer: "x", tokens: [HDFC, INFY] });
    h.hub.handleMessage(b, { type: "subscribe", consumer: "y", tokens: [HDFC] });

    h.hub.handleMessage(a, { type: "client_close" });

    expect(h.hub.getCache().refCount(HDFC)).toBe(1);
    expect(h.hub.getCache().refCount(INFY)).toBe(0);
    expect(h.connections[0].tokenSets.at(-1)).toEqual([HDFC]);
  });

  it("stops the stream when the last subscriber goes away", () => {
    const a = h.hub.attach(new FakePort());
    h.hub.handleMessage(a, { type: "subscribe", consumer: "x", tokens: [HDFC] });
    h.hub.handleMessage(a, { type: "unsubscribe", consumer: "x", tokens: [HDFC] });
    expect(h.connections[0].stopped).toBe(1);
    expect(h.hub.getHealth().status).toBe("idle");
  });

  it("ignores malformed tokens instead of subscribing to them", () => {
    const a = h.hub.attach(new FakePort());
    h.hub.handleMessage(a, { type: "subscribe", consumer: "x", tokens: [0, -5, "abc", HDFC] });
    expect(h.hub.getCache().subscribedTokens()).toEqual([HDFC]);
  });
});

describe("StreamHub stream handling", () => {
  let h: Harness;
  let port: FakePort;
  let portId: number;

  beforeEach(async () => {
    h = harness();
    port = new FakePort();
    portId = h.hub.attach(port);
    h.hub.handleMessage(portId, { type: "resolve", symbols: ["HDFCBANK"] });
    await flush();
    h.hub.handleMessage(portId, { type: "subscribe", consumer: "core", tokens: [HDFC] });
    await flush();
  });

  it("resolves a symbol to its real instrument token via REST", () => {
    expect(port.last("resolved")?.tokensBySymbol).toEqual({ HDFCBANK: HDFC });
  });

  it("hydrates every instrument when panels subscribe one token at a time", async () => {
    const fresh = harness();
    const rows = new FakePort();
    const id = fresh.hub.attach(rows);
    fresh.hub.handleMessage(id, { type: "resolve", symbols: ["HDFCBANK", "INFY"] });
    await flush();

    // Each Marketwatch row subscribes on its own; none may be dropped.
    fresh.hub.handleMessage(id, { type: "subscribe", consumer: "row", tokens: [HDFC] });
    fresh.hub.handleMessage(id, { type: "subscribe", consumer: "row", tokens: [INFY] });
    await flush();

    expect(fresh.hub.getCache().get(HDFC)?.ltp).toBe(727);
    expect(fresh.hub.getCache().get(INFY)?.ltp).toBe(1169.2);
  });

  it("reuses the snapshot fetched during resolution instead of fetching twice", async () => {
    const fresh = harness();
    const rows = new FakePort();
    const id = fresh.hub.attach(rows);
    fresh.hub.handleMessage(id, { type: "resolve", symbols: ["HDFCBANK"] });
    await flush();
    expect(fresh.quoteCalls).toEqual(["HDFCBANK"]);

    fresh.hub.handleMessage(id, { type: "subscribe", consumer: "row", tokens: [HDFC] });
    await flush();
    expect(fresh.quoteCalls).toEqual(["HDFCBANK"]);
    expect(fresh.hub.getCache().get(HDFC)?.ltp).toBe(727);
  });

  it("goes live on hello and adopts the server's heartbeat budget", async () => {
    h.hub.onFrame(helloFrame(4_000));
    await flush();
    const health = h.hub.getHealth();
    expect(health.status).toBe("live");
    expect(health.connectionId).toBe("conn-1");
    expect(health.heartbeatMs).toBe(4_000);
    expect(health.schemaVersion).toBe("1");
  });

  it("keeps REST data_status after a hello that omits it", async () => {
    expect(h.hub.getCache().getSession()?.dataStatus).toBe("last_session");
    h.hub.onFrame(helloFrame());
    await flush();
    const session = h.hub.getCache().getSession();
    expect(session?.marketState).toBe("open");
    expect(session?.sessionDate).toBe("2026-09-09");
    expect(session?.dataStatus).toBe("last_session");
    expect(session?.asOf).toBe("2026-08-14T15:29:00+05:30");
  });

  it("re-hydrates from REST on hello, because the stream sends deltas only", async () => {
    const before = h.quoteCalls.length;
    h.hub.onFrame(helloFrame());
    await flush();
    expect(h.quoteCalls.length).toBeGreaterThan(before);
    expect(h.hub.getCache().get(HDFC)?.ltp).toBe(727);
  });

  it("applies a tick and broadcasts it after the batch window", async () => {
    h.hub.onFrame(helloFrame());
    await flush();
    h.hub.onFrame(tickFrame(11, HDFC, 733.4));
    h.clock.advance(100);
    const update = port.last("instruments");
    expect(update?.updates[0].ltp).toBe(733.4);
    expect(h.hub.getHealth().lastEventId).toBe("11");
  });

  it("records the server's ingest lag from heartbeats without inventing latency", async () => {
    h.hub.onFrame(helloFrame());
    await flush();
    h.hub.onFrame({
      event: "heartbeat",
      id: null,
      retryMs: null,
      data: JSON.stringify({ server_time: "2026-09-09T04:00:00+00:00", subscribed: 1, lag_ms: 2100 }),
    });
    expect(h.hub.getHealth().lagMs).toBe(2_100);
  });

  it("treats a resync as a continuity break and re-reads state", async () => {
    h.hub.onFrame(helloFrame());
    await flush();
    h.hub.onFrame(tickFrame(50, HDFC, 800));
    const before = h.quoteCalls.length;
    h.hub.onFrame({
      event: "resync",
      id: null,
      retryMs: null,
      data: JSON.stringify({ reason: "unavailable_continuity", from_seq: 70 }),
    });
    await flush();
    expect(h.hub.getHealth().resync?.reason).toBe("unavailable_continuity");
    expect(h.quoteCalls.length).toBeGreaterThan(before);
    // A restarted server may reuse low sequences; the guard must not reject them.
    expect(h.hub.getCache().get(HDFC)?.seq).toBeNull();
  });

  it("classifies an unknown resync reason instead of trusting the wire string", async () => {
    h.hub.onFrame({
      event: "resync",
      id: null,
      retryMs: null,
      data: JSON.stringify({ reason: "something_new", from_seq: 1 }),
    });
    await flush();
    expect(h.hub.getHealth().resync?.reason).toBe("unknown");
    expect(h.hub.getHealth().resync?.rawReason).toBe("something_new");
  });

  it("surfaces PARTIAL_SESSION coverage from a session frame", async () => {
    h.hub.onFrame({
      event: "session",
      id: null,
      retryMs: null,
      data: JSON.stringify({
        market_state: "open",
        session_date: "2026-09-09",
        coverage: "PARTIAL_SESSION",
      }),
    });
    await flush();
    expect(port.last("session")?.session.coverage).toBe("PARTIAL_SESSION");
  });

  it("never lets a malformed frame reach the cache", async () => {
    h.hub.onFrame(helloFrame());
    await flush();
    h.hub.onFrame(tickFrame(5, HDFC, 700));
    h.hub.onFrame({ event: "tick", id: "6", retryMs: null, data: "{oops" });
    h.clock.advance(100);
    expect(h.hub.getCache().get(HDFC)?.ltp).toBe(700);
  });

  it("goes stale once frames stop for longer than the heartbeat budget", async () => {
    h.hub.onFrame(helloFrame(5_000));
    await flush();
    h.clock.advance(5_000 * STALE_HEARTBEAT_MULTIPLIER - 500);
    expect(h.hub.getHealth().status).toBe("live");
    h.clock.advance(2_000);
    expect(h.hub.getHealth().status).toBe("stale");
  });

  it("reports reconnecting while a retry is pending and disconnected when it is not", () => {
    h.hub.onClosed({ reason: "network", status: null, retryInMs: 1_000 });
    expect(h.hub.getHealth().status).toBe("reconnecting");
    h.hub.onClosed({ reason: "stream_capacity_exceeded", status: 503, retryInMs: null });
    expect(h.hub.getHealth().status).toBe("disconnected");
    expect(h.hub.getHealth().error).toBe("stream_capacity_exceeded");
  });

  it("ignores the close caused by its own token-set change", () => {
    h.hub.onFrame(helloFrame());
    h.hub.onClosed({ reason: "tokens_changed", status: null, retryInMs: null });
    expect(h.hub.getHealth().status).toBe("live");
  });
});

describe("StreamHub REST-backed panels", () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
  });

  it("shares one request between two consumers of the same panel", async () => {
    const a = h.hub.attach(new FakePort());
    const b = h.hub.attach(new FakePort());
    h.hub.handleMessage(a, { type: "aux_request", kind: "futures", key: "NIFTY" });
    h.hub.handleMessage(b, { type: "aux_request", kind: "futures", key: "NIFTY" });
    h.clock.advance(1);
    await flush();
    expect(h.rest.fetchFuturesBook).toHaveBeenCalledTimes(1);
  });

  it("reports an honest unavailable state instead of substituting data", async () => {
    const port = new FakePort();
    const id = h.hub.attach(port);
    h.hub.handleMessage(id, { type: "aux_request", kind: "candles", key: "NIFTY 50|5m" });
    h.clock.advance(1);
    await flush();
    const entry = port.last("aux")?.entry;
    expect(entry?.status).toBe("unavailable");
    expect(entry?.data).toBeNull();
    expect(entry?.reason).toBe("bars_not_built");
  });

  it("does not re-poll a closed market", async () => {
    const id = h.hub.attach(new FakePort());
    h.hub.handleMessage(id, { type: "aux_request", kind: "activity", key: "market" });
    h.clock.advance(1);
    await flush();
    h.clock.advance(120_000);
    await flush();
    expect(h.rest.fetchUnusualActivity).toHaveBeenCalledTimes(1);
  });
});
