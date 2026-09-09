import { act, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { marketBridge, type TestPort } from "@/market/bridge";
import { useActivityFeed, useInstrumentQuote, useStreamHealth } from "@/market/hooks";
import {
  emptyInstrumentState,
  initialStreamHealth,
  type WorkerMessage,
} from "@/worker/protocol";

const TOKEN = 341249;

function Quote({ token }: { token: number }) {
  const quote = useInstrumentQuote(token);
  return <span data-testid="ltp">{quote?.ltp ?? "none"}</span>;
}

function Health() {
  const health = useStreamHealth();
  return <span data-testid="status">{health.status}</span>;
}

function Activity() {
  const entry = useActivityFeed();
  return <span data-testid="activity">{entry?.status ?? "none"}</span>;
}

function emit(port: TestPort, ...messages: WorkerMessage[]): void {
  act(() => {
    for (const message of messages) port.emit(message);
  });
}

function sentOfType(port: TestPort, type: string) {
  return port.sent.filter((message) => message.type === type);
}

afterEach(() => {
  marketBridge.resetForTests();
});

describe("market bridge", () => {
  it("subscribes once for many consumers of the same token and releases on the last unmount", () => {
    const port = marketBridge.connectTestPort();
    const first = render(<Quote token={TOKEN} />);
    const second = render(<Quote token={TOKEN} />);

    expect(sentOfType(port, "subscribe")).toHaveLength(1);

    first.unmount();
    expect(sentOfType(port, "unsubscribe")).toHaveLength(0);

    second.unmount();
    expect(sentOfType(port, "unsubscribe")).toHaveLength(1);
  });

  it("fans an instrument update out to subscribers of that token only", () => {
    const port = marketBridge.connectTestPort();
    const view = render(
      <>
        <Quote token={TOKEN} />
        <Health />
      </>,
    );

    emit(port, {
      type: "instruments",
      updates: [{ ...emptyInstrumentState(TOKEN), ltp: 1648.9, origin: "stream" }],
    });

    expect(view.getByTestId("ltp")).toHaveTextContent("1648.9");
    expect(view.getByTestId("status")).toHaveTextContent("idle");
  });

  it("tracks stream health transitions through reconnect back to live", () => {
    const port = marketBridge.connectTestPort();
    const view = render(<Health />);

    for (const status of ["connecting", "live", "reconnecting", "live"] as const) {
      emit(port, { type: "health", health: { ...initialStreamHealth(), status } });
      expect(view.getByTestId("status")).toHaveTextContent(status);
    }
  });

  it("reference counts aux panels the same way as instruments", () => {
    const port = marketBridge.connectTestPort();
    const first = render(<Activity />);
    const second = render(<Activity />);

    expect(sentOfType(port, "aux_request")).toHaveLength(1);

    emit(port, {
      type: "aux",
      entry: {
        kind: "activity",
        key: "market",
        status: "ok",
        dataStatus: "live",
        marketState: "open",
        asOf: "2026-09-09T09:45:00+05:30",
        reason: null,
        updatedAt: Date.now(),
        data: [],
      },
    });
    expect(within(first.container).getByTestId("activity")).toHaveTextContent("ok");
    expect(within(second.container).getByTestId("activity")).toHaveTextContent("ok");

    first.unmount();
    expect(sentOfType(port, "aux_release")).toHaveLength(0);
    second.unmount();
    expect(sentOfType(port, "aux_release")).toHaveLength(1);
  });

  it("ignores malformed worker messages instead of throwing", () => {
    const port = marketBridge.connectTestPort();
    const view = render(<Health />);
    expect(() =>
      act(() => {
        port.emit({ type: "definitely_not_a_message" } as unknown as WorkerMessage);
      }),
    ).not.toThrow();
    expect(view.getByTestId("status")).toHaveTextContent("idle");
  });
});
