import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PulseTerminal } from "@/components/terminal/PulseTerminal";
import { marketBridge, type TestPort } from "@/market/bridge";
import {
  emptyInstrumentState,
  initialStreamHealth,
  type InstrumentState,
  type StreamHealth,
  type WorkerMessage,
} from "@/worker/protocol";

vi.mock("@/components/terminal/TerminalChart", () => ({
  TerminalChart: () => <div data-testid="terminal-chart" />,
}));

const NIFTY_TOKEN = 256265;
const HDFC_TOKEN = 341249;

function quote(token: number, symbol: string, ltp: number, changePct: number): InstrumentState {
  return {
    ...emptyInstrumentState(token),
    meta: { ...emptyInstrumentState(token).meta, symbol, exchange: "NSE", instrumentType: "EQ" },
    ltp,
    change: 1.25,
    changePct,
    volume: 4_820_000,
    timestamp: "2026-09-09T09:45:12+05:30",
    seq: 42,
    receivedAt: Date.now(),
    origin: "stream",
  };
}

function liveHealth(): StreamHealth {
  return {
    ...initialStreamHealth(),
    status: "live",
    connectionId: "conn-1",
    heartbeatMs: 15_000,
    lagMs: 84,
    subscribedTokens: 2,
  };
}

/** Seeds the bridge as if the worker had resolved tokens and pushed a snapshot. */
function seed(port: TestPort, messages: WorkerMessage[]): void {
  act(() => {
    for (const message of messages) port.emit(message);
  });
}

function openTerminal(): TestPort {
  const port = marketBridge.connectTestPort();
  render(<PulseTerminal />);
  seed(port, [
    {
      type: "resolved",
      tokensBySymbol: { "NIFTY 50": NIFTY_TOKEN, HDFCBANK: HDFC_TOKEN },
      unresolved: [],
    },
    {
      type: "snapshot",
      instruments: [
        quote(NIFTY_TOKEN, "NIFTY 50", 24612.35, 0.75),
        quote(HDFC_TOKEN, "HDFCBANK", 1648.9, -0.38),
      ],
      health: liveHealth(),
      session: {
        marketState: "open",
        coverage: null,
        sessionDate: "2026-09-09",
        dataStatus: "last_session",
        liveDataExpected: false,
        asOf: "2026-08-14T15:29:00+05:30",
      },
      tokensBySymbol: { "NIFTY 50": NIFTY_TOKEN, HDFCBANK: HDFC_TOKEN },
      aux: [],
    },
  ]);
  return port;
}

afterEach(() => {
  marketBridge.resetForTests();
});

describe("Pulse terminal live wiring", () => {
  it("renders streamed quotes in marketwatch instead of fixtures", () => {
    openTerminal();
    const row = screen.getByRole("row", { name: /HDFCBANK/i });
    expect(within(row).getByText("1,648.90")).toBeInTheDocument();
    expect(within(row).getByText("-0.38%")).toBeInTheDocument();
  });

  it("keeps the selected instrument while switching workspaces", () => {
    openTerminal();
    fireEvent.click(screen.getByRole("row", { name: /HDFCBANK/i }));
    expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Options" }));
    expect(screen.getByText(/DERIVATIVES \/ OPTION CHAIN/)).toBeInTheDocument();
    expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Futures" }));
    expect(screen.getByText(/FUTURES CURVE/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByText(/Unusual activity/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Intelligence" }));
    expect(screen.getByText(/LIVE CONTEXT/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Core" }));
    expect(screen.getAllByText("HDFCBANK").length).toBeGreaterThan(0);
  });

  it("shows the real stream status in the header and downgrades when it goes stale", () => {
    const port = openTerminal();
    expect(screen.getByTestId("stream-status")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("market-status")).toHaveTextContent("MARKET OPEN");
    expect(screen.getByTestId("data-status")).toHaveTextContent("LAST SESSION");

    seed(port, [{ type: "health", health: { ...liveHealth(), status: "stale" } }]);
    expect(screen.getByTestId("stream-status")).toHaveTextContent("STALE");
    expect(screen.getByTestId("market-status")).toHaveTextContent("MARKET OPEN");
  });

  it("reports PARTIAL when the session reports partial coverage", () => {
    const port = openTerminal();
    seed(port, [
      {
        type: "session",
        session: {
          marketState: "open",
          coverage: "PARTIAL_SESSION",
          sessionDate: "2026-09-09",
          dataStatus: "last_session",
          liveDataExpected: false,
          asOf: "2026-08-14T15:29:00+05:30",
        },
      },
    ]);
    expect(screen.getByTestId("stream-status")).toHaveTextContent("PARTIAL");
  });

  it("subscribes each token once even though several panels read it", () => {
    const port = openTerminal();
    fireEvent.click(screen.getByRole("row", { name: /HDFCBANK/i }));
    const subscribes = port.sent.filter(
      (message) => message.type === "subscribe" && message.tokens.includes(HDFC_TOKEN),
    );
    expect(subscribes).toHaveLength(1);
  });

  it("shows an honest unavailable state when a panel has no backend data", () => {
    openTerminal();
    fireEvent.click(screen.getByRole("tab", { name: "Options" }));
    expect(screen.getByText("Option chain unavailable")).toBeInTheDocument();
  });

  it("does not submit orders from Buy or Sell", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    openTerminal();
    fireEvent.click(screen.getByRole("button", { name: "Buy (visual placeholder)" }));
    fireEvent.click(screen.getByRole("button", { name: "Sell (visual placeholder)" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not show a fake alerts count", () => {
    openTerminal();
    expect(document.querySelector(".pulse-nav-badge")).toBeNull();
  });

  it("selects a universe instrument from Pulse search into TerminalContext", async () => {
    openTerminal();
    const input = screen.getByRole("searchbox", {
      name: "Search instruments, symbols or contracts",
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "RELIANCE" } });
    const option = await screen.findByRole("option", { name: /RELIANCE/i });
    fireEvent.click(option);
    expect(screen.getAllByText("RELIANCE").length).toBeGreaterThan(0);
  });
});
