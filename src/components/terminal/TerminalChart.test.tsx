import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalChart } from "@/components/terminal/TerminalChart";
import { marketBridge, type TestPort } from "@/market/bridge";
import { TerminalProvider } from "@/terminal/context";
import type { CandleBar, WorkerMessage } from "@/worker/protocol";

const candleSeries = { setData: vi.fn() };
const volumeSeries = { setData: vi.fn() };
const chart = {
  addCandlestickSeries: vi.fn(() => candleSeries),
  addHistogramSeries: vi.fn(() => volumeSeries),
  priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
  timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
  applyOptions: vi.fn(),
  remove: vi.fn(),
};
const createChart = vi.fn(() => chart);

vi.mock("lightweight-charts", () => ({
  createChart: (...args: unknown[]) => createChart(...(args as [])),
  ColorType: { Solid: "solid" },
}));

function bars(count: number, base: number): CandleBar[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_757_000_000 + i * 60,
    open: base + i,
    high: base + i + 2,
    low: base + i - 2,
    close: base + i + 1,
    volume: 1000 + i,
  }));
}

function candlesMessage(data: CandleBar[] | null, reason: string | null): WorkerMessage {
  return {
    type: "aux",
    entry: {
      kind: "candles",
      key: "NIFTY 50|5m",
      status: data === null ? "unavailable" : "ok",
      dataStatus: null,
      marketState: null,
      asOf: null,
      reason,
      updatedAt: Date.now(),
      data:
        data === null
          ? { interval: "5m", status: "unavailable", reason, source: null, bars: [] }
          : { interval: "5m", status: "ok", reason: null, source: "pipeline", bars: data },
    },
  };
}

function emit(port: TestPort, message: WorkerMessage): void {
  act(() => port.emit(message));
}

function mount() {
  const port = marketBridge.connectTestPort();
  render(
    <TerminalProvider>
      <TerminalChart />
    </TerminalProvider>,
  );
  return port;
}

beforeEach(() => {
  createChart.mockClear();
  chart.remove.mockClear();
  candleSeries.setData.mockClear();
  volumeSeries.setData.mockClear();
});

afterEach(() => {
  marketBridge.resetForTests();
});

describe("TerminalChart lifecycle", () => {
  it("does not create a chart and states the backend reason when no bars exist", () => {
    const port = mount();
    emit(port, candlesMessage(null, "bars_not_built"));

    expect(createChart).not.toHaveBeenCalled();
    expect(screen.getByText("Chart unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("The pipeline has not built OHLC bars for this instrument."),
    ).toBeInTheDocument();
  });

  it("creates the chart and both series once, then reuses them for later data", () => {
    const port = mount();
    emit(port, candlesMessage(bars(20, 24_600), null));

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(chart.addCandlestickSeries).toHaveBeenCalledTimes(1);
    expect(chart.addHistogramSeries).toHaveBeenCalledTimes(1);
    expect(candleSeries.setData).toHaveBeenCalledTimes(1);

    emit(port, candlesMessage(bars(21, 24_600), null));

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(chart.remove).not.toHaveBeenCalled();
    expect(candleSeries.setData).toHaveBeenCalledTimes(2);
    expect(volumeSeries.setData).toHaveBeenCalledTimes(2);
  });
});
