"use client";

/**
 * Browser-side mirror of the worker's MarketCache.
 *
 * Holds one SharedWorker port for the whole tab and keeps a per-token
 * subscriber registry so a single instrument update notifies only the
 * components displaying that instrument (§11).
 */

import {
  WORKER_PROTOCOL_VERSION,
  initialStreamHealth,
  auxId,
  type AuxEntry,
  type AuxKind,
  type ClientMessage,
  type InstrumentState,
  type SessionState,
  type StreamHealth,
  type WorkerMessage,
} from "@/worker/protocol";

const PING_INTERVAL_MS = 20_000;

type Listener = () => void;

interface PortAdapter {
  postMessage(message: ClientMessage): void;
  addEventListener(listener: (message: WorkerMessage) => void): void;
  close(): void;
}

export type WorkerTransport = "shared" | "dedicated" | "unavailable";

export interface TestPort {
  /** Everything the bridge posted to the worker, in order. */
  sent: ClientMessage[];
  /** Delivers a worker message as if it arrived over the port. */
  emit(message: WorkerMessage): void;
}

class MarketBridge {
  private port: PortAdapter | null = null;
  private transport: WorkerTransport = "unavailable";
  private pingTimer: number | null = null;

  private readonly instruments = new Map<number, InstrumentState>();
  private readonly instrumentListeners = new Map<number, Set<Listener>>();
  private readonly tokenRefs = new Map<number, number>();

  private health: StreamHealth = initialStreamHealth();
  private readonly healthListeners = new Set<Listener>();

  private session: SessionState | null = null;
  private readonly sessionListeners = new Set<Listener>();

  private readonly aux = new Map<string, AuxEntry>();
  private readonly auxListeners = new Map<string, Set<Listener>>();
  private readonly auxRefs = new Map<string, number>();

  private tokensBySymbol: Record<string, number> = {};
  private readonly symbolListeners = new Set<Listener>();
  private readonly requestedSymbols = new Set<string>();

  /* ---------------- lifecycle ---------------- */

  private ensureConnected(): void {
    if (this.port !== null || typeof window === "undefined") return;

    if (typeof SharedWorker !== "undefined") {
      const worker = new SharedWorker(
        new URL("../worker/stream.worker.ts", import.meta.url),
        { type: "module", name: "pulse-market-stream" },
      );
      this.transport = "shared";
      this.port = adaptMessagePort(worker.port);
    } else if (typeof Worker !== "undefined") {
      // No SharedWorker (older Safari): one worker per tab, still never per component.
      const worker = new Worker(new URL("../worker/stream.worker.ts", import.meta.url), {
        type: "module",
      });
      this.transport = "dedicated";
      this.port = adaptWorker(worker);
    } else {
      this.transport = "unavailable";
      return;
    }

    this.port.addEventListener((message) => this.receive(message));
    this.post({ type: "client_hello", protocolVersion: WORKER_PROTOCOL_VERSION });

    this.pingTimer = window.setInterval(() => {
      this.post({ type: "client_ping" });
    }, PING_INTERVAL_MS);

    window.addEventListener("pagehide", () => this.post({ type: "client_close" }), {
      once: true,
    });
  }

  getTransport(): WorkerTransport {
    this.ensureConnected();
    return this.transport;
  }

  private post(message: ClientMessage): void {
    this.ensureConnected();
    this.port?.postMessage(message);
  }

  /* ---------------- inbound ---------------- */

  private receive(message: WorkerMessage): void {
    switch (message.type) {
      case "worker_ready":
        break;
      case "snapshot":
        this.applyInstruments(message.instruments);
        this.applyHealth(message.health);
        this.applySession(message.session);
        this.applySymbols(message.tokensBySymbol);
        for (const entry of message.aux) this.applyAux(entry);
        break;
      case "instruments":
        this.applyInstruments(message.updates);
        break;
      case "health":
        this.applyHealth(message.health);
        break;
      case "session":
        this.applySession(message.session);
        break;
      case "resolved":
        this.applySymbols(message.tokensBySymbol);
        break;
      case "aux":
        this.applyAux(message.entry);
        break;
      case "worker_error":
        break;
    }
  }

  private applyInstruments(updates: InstrumentState[]): void {
    for (const state of updates) {
      this.instruments.set(state.token, state);
      notify(this.instrumentListeners.get(state.token));
    }
  }

  private applyHealth(health: StreamHealth): void {
    this.health = health;
    notify(this.healthListeners);
  }

  private applySession(session: SessionState | null): void {
    if (session === null) return;
    this.session = session;
    notify(this.sessionListeners);
  }

  private applySymbols(map: Record<string, number>): void {
    let changed = false;
    const next = { ...this.tokensBySymbol };
    for (const [symbol, token] of Object.entries(map)) {
      if (next[symbol] === token) continue;
      next[symbol] = token;
      changed = true;
    }
    if (!changed) return;
    this.tokensBySymbol = next;
    notify(this.symbolListeners);
  }

  private applyAux(entry: AuxEntry): void {
    const id = auxId(entry.kind, entry.key);
    this.aux.set(id, entry);
    notify(this.auxListeners.get(id));
  }

  /* ---------------- instruments ---------------- */

  subscribeInstrument(token: number, listener: Listener): () => void {
    this.ensureConnected();
    let listeners = this.instrumentListeners.get(token);
    if (!listeners) {
      listeners = new Set();
      this.instrumentListeners.set(token, listeners);
    }
    listeners.add(listener);

    const refs = (this.tokenRefs.get(token) ?? 0) + 1;
    this.tokenRefs.set(token, refs);
    if (refs === 1) this.post({ type: "subscribe", consumer: "bridge", tokens: [token] });

    return () => {
      listeners.delete(listener);
      const remaining = (this.tokenRefs.get(token) ?? 1) - 1;
      if (remaining > 0) {
        this.tokenRefs.set(token, remaining);
        return;
      }
      this.tokenRefs.delete(token);
      this.instrumentListeners.delete(token);
      this.instruments.delete(token);
      this.post({ type: "unsubscribe", consumer: "bridge", tokens: [token] });
    };
  }

  getInstrument(token: number): InstrumentState | undefined {
    return this.instruments.get(token);
  }

  /* ---------------- health + session ---------------- */

  subscribeHealth(listener: Listener): () => void {
    this.ensureConnected();
    this.healthListeners.add(listener);
    return () => this.healthListeners.delete(listener);
  }

  getHealth(): StreamHealth {
    return this.health;
  }

  subscribeSession(listener: Listener): () => void {
    this.ensureConnected();
    this.sessionListeners.add(listener);
    return () => this.sessionListeners.delete(listener);
  }

  getSession(): SessionState | null {
    return this.session;
  }

  /* ---------------- symbol resolution ---------------- */

  subscribeSymbols(listener: Listener): () => void {
    this.ensureConnected();
    this.symbolListeners.add(listener);
    return () => this.symbolListeners.delete(listener);
  }

  getSymbolTokens(): Record<string, number> {
    return this.tokensBySymbol;
  }

  resolveSymbols(symbols: string[]): void {
    const pending = symbols.filter(
      (symbol) => symbol !== "" && !this.requestedSymbols.has(symbol),
    );
    if (pending.length === 0) return;
    for (const symbol of pending) this.requestedSymbols.add(symbol);
    this.post({ type: "resolve", symbols: pending });
  }

  /* ---------------- aux panels ---------------- */

  subscribeAux(kind: AuxKind, key: string, listener: Listener): () => void {
    this.ensureConnected();
    const id = auxId(kind, key);
    let listeners = this.auxListeners.get(id);
    if (!listeners) {
      listeners = new Set();
      this.auxListeners.set(id, listeners);
    }
    listeners.add(listener);

    const refs = (this.auxRefs.get(id) ?? 0) + 1;
    this.auxRefs.set(id, refs);
    if (refs === 1) this.post({ type: "aux_request", kind, key });

    return () => {
      listeners.delete(listener);
      const remaining = (this.auxRefs.get(id) ?? 1) - 1;
      if (remaining > 0) {
        this.auxRefs.set(id, remaining);
        return;
      }
      this.auxRefs.delete(id);
      this.auxListeners.delete(id);
      this.aux.delete(id);
      this.post({ type: "aux_release", kind, key });
    };
  }

  getAux(kind: AuxKind, key: string): AuxEntry | undefined {
    return this.aux.get(auxId(kind, key));
  }

  /**
   * Test seam. Installs an in-memory port so tests can drive the real protocol
   * path (subscribe refcounts, cache fan-out) without a worker.
   */
  connectTestPort(): TestPort {
    this.resetForTests();
    const sent: ClientMessage[] = [];
    let deliver: (message: WorkerMessage) => void = () => undefined;
    this.port = {
      postMessage: (message) => {
        sent.push(message);
      },
      addEventListener: (listener) => {
        deliver = listener;
      },
      close: () => undefined,
    };
    this.transport = "dedicated";
    this.port.addEventListener((message) => this.receive(message));
    return { sent, emit: (message) => deliver(message) };
  }

  /** Test seam. Not used by application code. */
  resetForTests(): void {
    if (this.pingTimer !== null && typeof window !== "undefined") {
      window.clearInterval(this.pingTimer);
    }
    this.pingTimer = null;
    this.port?.close();
    this.port = null;
    this.transport = "unavailable";
    this.instruments.clear();
    this.instrumentListeners.clear();
    this.tokenRefs.clear();
    this.aux.clear();
    this.auxListeners.clear();
    this.auxRefs.clear();
    this.requestedSymbols.clear();
    this.tokensBySymbol = {};
    this.session = null;
    this.health = initialStreamHealth();
  }
}

function notify(listeners: Set<Listener> | undefined): void {
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function adaptMessagePort(port: MessagePort): PortAdapter {
  port.start();
  return {
    postMessage: (message) => port.postMessage(message),
    addEventListener: (listener) => {
      port.addEventListener("message", (event: MessageEvent) => {
        listener(event.data as WorkerMessage);
      });
    },
    close: () => port.close(),
  };
}

function adaptWorker(worker: Worker): PortAdapter {
  return {
    postMessage: (message) => worker.postMessage(message),
    addEventListener: (listener) => {
      worker.addEventListener("message", (event: MessageEvent) => {
        listener(event.data as WorkerMessage);
      });
    },
    close: () => worker.terminate(),
  };
}

export const marketBridge = new MarketBridge();
