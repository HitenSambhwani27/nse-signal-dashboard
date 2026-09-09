import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PulseTerminal } from "@/components/terminal/PulseTerminal";

vi.mock("@/components/terminal/TerminalChart", () => ({
  TerminalChart: () => <div data-testid="terminal-chart" />,
}));

describe("Pulse terminal Phase 6A shell", () => {
  it("keeps selected instrument while switching workspaces", () => {
    render(<PulseTerminal />);
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
    expect(screen.getByText(/CONTEXT SHELL/)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Insufficient history/).length).toBeGreaterThan(0);
  });

  it("does not submit orders from Buy or Sell", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<PulseTerminal />);
    fireEvent.click(screen.getByRole("button", { name: "Buy (visual placeholder)" }));
    fireEvent.click(screen.getByRole("button", { name: "Sell (visual placeholder)" }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("highlights the ATM option row", () => {
    render(<PulseTerminal />);
    fireEvent.click(screen.getByRole("tab", { name: "Options" }));
    expect(screen.getByText("ATM")).toBeInTheDocument();
  });
});
