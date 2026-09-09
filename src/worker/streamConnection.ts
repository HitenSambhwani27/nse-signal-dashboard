/**
 * The single upstream SSE connection.
 *
 * fetch + ReadableStream rather than EventSource because Phase 5 needs an
 * explicit `Last-Event-ID` request header, a controlled backoff, and honouring
 * of `Retry-After` on a 503 `stream_capacity_exceeded`. EventSource can do none
 * of those and would retry a capacity rejection forever.
 *
 * Exactly one request is in flight at any time. Changing the token set closes
 * the current request and opens a new one, because Phase 5 takes the
 * subscription set as a query parameter.
 */

import { MAX_TOKENS_PER_CONNECTION, STREAM_GROUPS } from "./protocol";
import { SseParser, type SseFrame } from "./sse";

export const BACKOFF_STEPS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;

export interface StreamConnectionDeps {
  fetchImpl: typeof fetch;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (handle: number) => void;
  /** Deterministic in tests; jittered in the browser. */
  jitter: () => number;
}

export interface StreamConnectionCallbacks {
  onConnecting: (attempt: number) => void;
  onOpen: () => void;
  onFrame: (frame: SseFrame) => void;
  /** Connection ended. `retryInMs` is null when no retry is scheduled. */
  onClosed: (info: { reason: string; status: number | null; retryInMs: number | null }) => void;
}

export function streamUrl(tokens: number[]): string {
  const capped = tokens.slice(0, MAX_TOKENS_PER_CONNECTION);
  return `/api/v1/stream?tokens=${capped.join(",")}&groups=${STREAM_GROUPS}`;
}

export class StreamConnection {
  private tokens: number[] = [];
  private running = false;
  private controller: AbortController | null = null;
  private timer: number | null = null;
  private attempt = 0;
  private lastEventId: string | null = null;
  private generation = 0;
  private readonly parser = new SseParser();

  constructor(
    private readonly deps: StreamConnectionDeps,
    private readonly callbacks: StreamConnectionCallbacks,
  ) {}

  getLastEventId(): string | null {
    return this.lastEventId;
  }

  setLastEventId(id: string | null): void {
    this.lastEventId = id;
  }

  /** Replaces the subscription set. Reconnects only when the set really changed. */
  setTokens(tokens: number[]): void {
    const next = [...new Set(tokens)].sort((a, b) => a - b);
    if (sameTokens(next, this.tokens)) return;
    this.tokens = next;
    if (!this.running) return;
    this.cancelRetry();
    this.abortCurrent("tokens_changed");
    this.attempt = 0;
    void this.open();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    void this.open();
  }

  stop(): void {
    this.running = false;
    this.cancelRetry();
    this.abortCurrent("stopped");
  }

  private cancelRetry(): void {
    if (this.timer !== null) {
      this.deps.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private abortCurrent(reason: string): void {
    this.generation += 1;
    const controller = this.controller;
    this.controller = null;
    if (controller) controller.abort(reason);
  }

  private scheduleRetry(explicitMs: number | null): number | null {
    if (!this.running) return null;
    const index = Math.min(Math.max(this.attempt - 1, 0), BACKOFF_STEPS_MS.length - 1);
    const step = BACKOFF_STEPS_MS[index];
    const base = explicitMs ?? step;
    const delay = Math.round(base + this.deps.jitter() * 250);
    this.cancelRetry();
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.open();
    }, delay);
    return delay;
  }

  private async open(): Promise<void> {
    if (!this.running) return;
    if (this.tokens.length === 0) {
      this.callbacks.onClosed({ reason: "no_tokens", status: null, retryInMs: null });
      return;
    }

    const generation = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.parser.reset();
    this.attempt += 1;
    this.callbacks.onConnecting(this.attempt);

    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (this.lastEventId !== null) headers["Last-Event-ID"] = this.lastEventId;

    let response: Response;
    try {
      response = await this.deps.fetchImpl(streamUrl(this.tokens), {
        method: "GET",
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (generation !== this.generation) return;
      const retryInMs = this.scheduleRetry(null);
      this.callbacks.onClosed({ reason: describe(err), status: null, retryInMs });
      return;
    }

    if (generation !== this.generation) return;

    if (!response.ok || !response.body) {
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
      const retryInMs = this.scheduleRetry(retryAfter);
      this.callbacks.onClosed({
        reason: await describeErrorBody(response),
        status: response.status,
        retryInMs,
      });
      return;
    }

    this.attempt = 0;
    this.callbacks.onOpen();

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (generation !== this.generation) return;
        if (done) break;
        if (value === undefined) continue;
        for (const frame of this.parser.feed(value)) {
          if (frame.id !== null) this.lastEventId = frame.id;
          this.callbacks.onFrame(frame);
        }
      }
    } catch (err) {
      if (generation !== this.generation) return;
      const retryInMs = this.scheduleRetry(null);
      this.callbacks.onClosed({ reason: describe(err), status: null, retryInMs });
      return;
    } finally {
      reader.cancel().catch(() => undefined);
    }

    if (generation !== this.generation) return;
    const retryInMs = this.scheduleRetry(null);
    this.callbacks.onClosed({ reason: "stream_ended", status: null, retryInMs });
  }
}

function sameTokens(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((token, i) => token === b[i]);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number.parseInt(header, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds, 60) * 1_000;
}

async function describeErrorBody(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object" && "reason" in payload) {
      const reason = (payload as { reason?: unknown }).reason;
      if (typeof reason === "string" && reason !== "") return reason;
    }
  } catch {
    /* fall through to the status text */
  }
  return `http_${response.status}`;
}

function describe(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") return "aborted";
  if (err instanceof Error) return err.message;
  return "stream_error";
}
