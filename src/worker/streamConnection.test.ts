import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StreamConnection,
  streamUrl,
  type StreamConnectionCallbacks,
} from "@/worker/streamConnection";
import type { SseFrame } from "@/worker/sse";

interface Pending {
  url: string;
  init: RequestInit;
  resolve: (response: Response) => void;
  reject: (error: unknown) => void;
}

class Harness {
  now = 0;
  readonly pending: Pending[] = [];
  readonly frames: SseFrame[] = [];
  readonly closes: { reason: string; status: number | null; retryInMs: number | null }[] = [];
  readonly attempts: number[] = [];
  opens = 0;

  private handle = 1;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();

  readonly callbacks: StreamConnectionCallbacks = {
    onConnecting: (attempt) => this.attempts.push(attempt),
    onOpen: () => {
      this.opens += 1;
    },
    onFrame: (frame) => this.frames.push(frame),
    onClosed: (info) => this.closes.push(info),
  };

  readonly deps = {
    fetchImpl: ((url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        this.pending.push({ url, init, resolve, reject });
      })) as unknown as typeof fetch,
    now: () => this.now,
    setTimer: (fn: () => void, ms: number) => {
      const id = this.handle++;
      this.timers.set(id, { at: this.now + ms, fn });
      return id;
    },
    clearTimer: (id: number) => {
      this.timers.delete(id);
    },
    jitter: () => 0,
  };

  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
    }
    this.now = target;
  }

  scheduledDelays(): number[] {
    return [...this.timers.values()].map((t) => t.at - this.now);
  }
}

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("streamUrl", () => {
  it("passes the token set and field groups Phase 5 expects", () => {
    expect(streamUrl([256265, 341249])).toBe(
      "/api/v1/stream?tokens=256265,341249&groups=price,volume,oi,depth,quality",
    );
  });

  it("caps the token list at the documented per-connection limit", () => {
    const tokens = Array.from({ length: 300 }, (_, i) => i + 1);
    const url = streamUrl(tokens);
    expect(url.split("tokens=")[1].split("&")[0].split(",")).toHaveLength(250);
  });
});

describe("StreamConnection", () => {
  let h: Harness;
  let connection: StreamConnection;

  beforeEach(() => {
    h = new Harness();
    connection = new StreamConnection(h.deps, h.callbacks);
  });

  it("does not open a request when nothing is subscribed", () => {
    connection.start();
    expect(h.pending).toHaveLength(0);
    expect(h.closes[0].reason).toBe("no_tokens");
  });

  it("reads frames from the response body and tracks the last event id", async () => {
    connection.setTokens([341249]);
    connection.start();
    expect(h.pending).toHaveLength(1);
    h.pending[0].resolve(
      sseResponse(["event: hello\ndata: {}\n\n", 'id: 42\nevent: tick\ndata: {"t":1}\n\n']),
    );
    await flush();
    await flush();
    expect(h.frames.map((f) => f.event)).toEqual(["hello", "tick"]);
    expect(connection.getLastEventId()).toBe("42");
  });

  it("replays Last-Event-ID on the next connection", async () => {
    connection.setTokens([341249]);
    connection.start();
    h.pending[0].resolve(sseResponse(['id: 7\nevent: tick\ndata: {"t":1}\n\n']));
    await flush();
    await flush();

    // The stream ended, so a retry is queued.
    h.advance(1_000);
    expect(h.pending).toHaveLength(2);
    const headers = h.pending[1].init.headers as Record<string, string>;
    expect(headers["Last-Event-ID"]).toBe("7");
  });

  it("keeps exactly one request in flight when the token set changes", async () => {
    connection.setTokens([341249]);
    connection.start();
    expect(h.pending).toHaveLength(1);

    connection.setTokens([341249, 408065]);
    await flush();
    expect(h.pending).toHaveLength(2);
    expect(h.pending[1].url).toContain("tokens=341249,408065");
    // The superseded request was aborted rather than left running.
    expect((h.pending[0].init.signal as AbortSignal).aborted).toBe(true);
  });

  it("does not reconnect when the token set is unchanged", () => {
    connection.setTokens([341249]);
    connection.start();
    connection.setTokens([341249]);
    expect(h.pending).toHaveLength(1);
  });

  it("honours Retry-After on a capacity rejection instead of hammering", async () => {
    connection.setTokens([341249]);
    connection.start();
    h.pending[0].resolve(
      new Response(JSON.stringify({ reason: "stream_capacity_exceeded" }), {
        status: 503,
        headers: { "retry-after": "5", "content-type": "application/json" },
      }),
    );
    await flush();
    expect(h.closes[0].status).toBe(503);
    expect(h.closes[0].reason).toBe("stream_capacity_exceeded");
    expect(h.closes[0].retryInMs).toBe(5_000);
  });

  it("backs off progressively across repeated failures", async () => {
    connection.setTokens([341249]);
    connection.start();
    const delays: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      h.pending[i].reject(new Error("network down"));
      await flush();
      delays.push(h.closes[i].retryInMs ?? 0);
      h.advance(delays[i]);
    }
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
  });

  it("stops retrying once stopped", async () => {
    connection.setTokens([341249]);
    connection.start();
    h.pending[0].reject(new Error("network down"));
    await flush();
    connection.stop();
    h.advance(60_000);
    expect(h.pending).toHaveLength(1);
  });

  it("reports the first attempt as 1 and increments only on failure", async () => {
    connection.setTokens([341249]);
    connection.start();
    expect(h.attempts).toEqual([1]);
    h.pending[0].reject(new Error("boom"));
    await flush();
    h.advance(1_000);
    expect(h.attempts).toEqual([1, 2]);
  });
});

describe("StreamConnection abort semantics", () => {
  it("suppresses callbacks from a superseded generation", async () => {
    const h = new Harness();
    const connection = new StreamConnection(h.deps, h.callbacks);
    connection.setTokens([1]);
    connection.start();
    connection.setTokens([2]);
    await flush();

    // Resolve the stale request; it must not emit frames.
    h.pending[0].resolve(sseResponse(['event: tick\ndata: {"t":1}\n\n']));
    await flush();
    await flush();
    expect(h.frames).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
