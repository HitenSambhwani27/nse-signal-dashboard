/**
 * SharedWorker entry point — the ONLY place in the browser that opens a market
 * data connection. React components never see a MessagePort or a stream frame.
 *
 * Also runs correctly as a dedicated Worker, which is the fallback for browsers
 * without SharedWorker support. In that mode each tab has its own connection,
 * which is a browser limitation, not a second transport design.
 */

import { StreamHub } from "./hub";
import * as rest from "./rest";
import { StreamConnection } from "./streamConnection";

interface ConnectEvent extends Event {
  readonly ports: ReadonlyArray<MessagePort>;
}

interface WorkerScope {
  /** Present only in a SharedWorker global scope. */
  onconnect?: ((event: ConnectEvent) => void) | null;
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

const scope = globalThis as unknown as WorkerScope;

const hub = new StreamHub(
  {
    now: () => Date.now(),
    setTimer: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
    clearTimer: (handle) => globalThis.clearTimeout(handle),
    rest,
    workerId: `w${Date.now().toString(36)}`,
  },
  (owner) =>
    new StreamConnection(
      {
        fetchImpl: (...args) => globalThis.fetch(...args),
        now: () => Date.now(),
        setTimer: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
        clearTimer: (handle) => globalThis.clearTimeout(handle),
        jitter: () => Math.random(),
      },
      {
        onConnecting: (attempt) => owner.onConnecting(attempt),
        onOpen: () => owner.onOpen(),
        onFrame: (frame) => owner.onFrame(frame),
        onClosed: (info) => owner.onClosed(info),
      },
    ),
);

function attach(port: MessagePort): void {
  const id = hub.attach({ postMessage: (message) => port.postMessage(message) });
  port.addEventListener("message", (event: MessageEvent) => {
    hub.handleMessage(id, event.data);
  });
  port.start();
}

const isSharedWorker = "onconnect" in scope;

if (isSharedWorker) {
  scope.onconnect = (event: ConnectEvent) => {
    for (const port of event.ports) attach(port);
  };
} else {
  const id = hub.attach({ postMessage: (message) => scope.postMessage(message) });
  scope.addEventListener("message", (event: MessageEvent) => {
    hub.handleMessage(id, event.data);
  });
}
