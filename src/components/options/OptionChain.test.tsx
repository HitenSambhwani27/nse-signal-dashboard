import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OptionChainTable } from "@/components/options/OptionChain";
import { FinancialTable } from "@/components/tables/FinancialTable";
import { ChainStatusBadge } from "@/components/data/Badges";
import type { OptionChain } from "@/api/types";

const chain: OptionChain = {
  underlying: "NIFTY",
  expiry: "2026-09-08",
  spot: 100,
  atm: 100,
  chain_completeness: 0.2,
  complete: false,
  chain_status: "truncated",
  eligible_contract_count: 12,
  selected_contract_count: 2,
  missing_contract_count: 10,
  truncated: true,
  partial: true,
  number_of_strikes: 1,
  pcr_oi: null,
  pcr_volume: null,
  pcr_near_atm_oi: null,
  total_ce_oi: null,
  total_pe_oi: null,
  highest_ce_oi: null,
  highest_pe_oi: null,
  largest_ce_oi_increase: null,
  largest_pe_oi_increase: null,
  largest_ce_oi_decrease: null,
  largest_pe_oi_decrease: null,
  max_pain: {
    max_pain_strike: null,
    expiry: "2026-09-08",
    number_of_strikes: 1,
    chain_completeness: 0.2,
    status: "insufficient_chain",
  },
  multi_strike: [],
  strikes: [
    {
      strike: 100,
      distance_from_atm: 0,
      ce: {
        ltp: 2,
        price_change: null,
        price_change_pct: null,
        volume: null,
        volume_delta: null,
        oi: 1,
        oi_change: null,
        oi_change_pct: null,
        last_quantity: null,
        best_bid: null,
        best_ask: null,
        spread: null,
        mid_price: null,
        bid_depth_5: null,
        ask_depth_5: null,
        depth_imbalance: null,
        moneyness: "ATM",
        iv: null,
      },
      pe: null,
    },
  ],
};

describe("option chain rendering", () => {
  it("renders strike and does not print 0 for null PCR/IV", () => {
    render(<OptionChainTable chain={chain} />);
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
    expect(screen.queryByText("0.000")).not.toBeInTheDocument();
  });
});

describe("chain status badge", () => {
  it("warns on truncated chains", () => {
    render(<ChainStatusBadge status="truncated" truncated />);
    expect(screen.getByText(/subscription limit/i)).toBeInTheDocument();
  });

  it("does not call a listed chain live-complete when quotes are empty", () => {
    render(<ChainStatusBadge status="complete" quoteStatus="empty" />);
    expect(screen.getByText(/no live quotes/i)).toBeInTheDocument();
    expect(screen.queryByText(/chain complete/i)).not.toBeInTheDocument();
  });
});

describe("financial table", () => {
  it("shows em dash via custom render and empty state", () => {
    render(
      <FinancialTable
        rows={[{ symbol: "AAA", px: null as number | null }]}
        columns={[
          { key: "s", header: "Symbol", render: (r) => r.symbol },
          { key: "p", header: "LTP", align: "right", render: (r) => (r.px == null ? "—" : String(r.px)) },
        ]}
        rowKey={(r) => r.symbol}
      />,
    );
    expect(screen.getByText("AAA")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
