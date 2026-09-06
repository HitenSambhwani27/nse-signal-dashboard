"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { optionsActivityPath, optionsOiPath, optionsPath } from "@/api/options";
import type { OptionActivityResponse, OptionChainResponse, OptionOiResponse } from "@/api/types";
import { ChainStatusBadge, DataFreshnessBadge } from "@/components/data/Badges";
import { MetricCard } from "@/components/data/MetricCard";
import { ErrorState, LoadingState } from "@/components/data/States";
import { StrikeOIChart } from "@/components/charts/StrikeOIChart";
import { OptionChainTable } from "@/components/options/OptionChain";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import { useApiQuery } from "@/hooks/useApiQuery";
import { formatInr, formatOi, formatPcr, formatTimestamp } from "@/lib/format";
import { INDEX_INSTRUMENTS, decodeParam, underlyingForSymbol } from "@/lib/instruments";
import type { OptionActivityRow } from "@/api/types";

export default function OptionsTerminalPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const underlying = underlyingForSymbol(decodeParam(params.underlying as string) || "NIFTY");
  const expiry = search.get("expiry");
  const view = search.get("view") || "chain";
  const chainQ = useApiQuery<OptionChainResponse>(optionsPath(underlying, expiry), 5000);
  const chain = chainQ.data?.chain ?? null;
  const chosenExpiry = expiry || chain?.expiry || "";
  const oiQ = useApiQuery<OptionOiResponse>(
    chosenExpiry ? optionsOiPath(underlying, chosenExpiry) : null,
    8000,
  );
  const actQ = useApiQuery<OptionActivityResponse>(
    chosenExpiry ? optionsActivityPath(underlying, chosenExpiry) : null,
    8000,
  );

  function setExpiry(next: string) {
    const sp = new URLSearchParams(search.toString());
    if (next) sp.set("expiry", next);
    else sp.delete("expiry");
    router.replace(`/options/${encodeURIComponent(underlying)}?${sp.toString()}`);
  }

  function setView(next: string) {
    const sp = new URLSearchParams(search.toString());
    sp.set("view", next);
    router.replace(`/options/${encodeURIComponent(underlying)}?${sp.toString()}`);
  }

  const actCols: Column<OptionActivityRow>[] = [
    { key: "k", header: "Strike", align: "right", render: (r) => (r.strike == null ? "—" : String(r.strike)) },
    { key: "side", header: "Side", render: (r) => r.side ?? "—" },
    { key: "sym", header: "Symbol", render: (r) => r.symbol ?? "—" },
    { key: "vol", header: "Volume level", render: (r) => r.volume_level ?? "—" },
    { key: "lg", header: "Large trade", render: (r) => r.large_trade ?? "—" },
    {
      key: "sc",
      header: "Score",
      align: "right",
      render: (r) => (r.unusual?.activity_score == null ? "—" : r.unusual.activity_score.toFixed(1)),
    },
    { key: "rs", header: "Reasons", render: (r) => r.unusual?.reasons?.join("; ") || "—" },
  ];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{underlying} options</h1>
          <p className="page-sub">
            Chain from GET /api/v1/options/{underlying}
            {chosenExpiry ? `/${chosenExpiry}` : ""}. IV is not in this API.
          </p>
        </div>
        <div className="row">
          {INDEX_INSTRUMENTS.map((i) => (
            <Link
              key={i.underlying}
              className={`btn ${i.underlying === underlying ? "active" : ""}`}
              href={`/options/${i.underlying}`}
            >
              {i.label}
            </Link>
          ))}
          <DataFreshnessBadge asOf={chainQ.data?.as_of} />
        </div>
      </div>

      {chainQ.status === "error" && !chain ? <ErrorState detail={chainQ.error} /> : null}
      {chainQ.status === "loading" && !chain ? <LoadingState label="Loading option chain" /> : null}

      {chain ? (
        <>
          <div className="row">
            <label className="page-sub">Expiry</label>
            <select
              className="btn"
              value={chosenExpiry}
              onChange={(e) => setExpiry(e.target.value)}
            >
              {(chain.available_expiries?.length ? chain.available_expiries : [chosenExpiry].filter(Boolean)).map(
                (exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ),
              )}
            </select>
            <ChainStatusBadge
              status={chain.chain_status}
              truncated={chain.truncated}
              quoteStatus={chain.quote_status}
            />
            {chain.truncated ? (
              <span className="warn-line">Partial chain — subscription limit</span>
            ) : chain.chain_status === "partial" ? (
              <span className="warn-line">Partial option chain</span>
            ) : null}
          </div>
          <div className="grid-4">
            <MetricCard label="Underlying" value={chain.underlying ?? underlying} />
            <MetricCard label="Spot" value={formatInr(chain.spot)} />
            <MetricCard label="ATM" value={chain.atm == null ? "—" : String(chain.atm)} />
            <MetricCard label="PCR OI" value={formatPcr(chain.pcr_oi)} />
            <MetricCard label="PCR volume" value={formatPcr(chain.pcr_volume)} />
            <MetricCard label="PCR near ATM" value={formatPcr(chain.pcr_near_atm_oi)} />
            <MetricCard
              label="Max pain"
              value={
                chain.max_pain?.max_pain_strike == null
                  ? chain.max_pain?.status === "insufficient_chain"
                    ? "Insufficient data"
                    : "—"
                  : String(chain.max_pain.max_pain_strike)
              }
            />
            <MetricCard label="As of" value={formatTimestamp(chainQ.data?.as_of)} />
            <MetricCard label="CE OI" value={formatOi(chain.total_ce_oi)} />
            <MetricCard label="PE OI" value={formatOi(chain.total_pe_oi)} />
            <MetricCard
              label="Completeness"
              value={
                chain.chain_completeness == null
                  ? "—"
                  : `${(chain.chain_completeness * 100).toFixed(0)}%`
              }
            />
            <MetricCard
              label="Coverage"
              value={`${chain.selected_contract_count ?? "—"} / ${chain.eligible_contract_count ?? "—"}`}
            />
          </div>
          <div className="tabs">
            <button className={view === "chain" ? "active" : ""} onClick={() => setView("chain")}>
              Chain
            </button>
            <button className={view === "oi" ? "active" : ""} onClick={() => setView("oi")}>
              OI
            </button>
            <button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}>
              Activity
            </button>
          </div>
          {view === "chain" ? <OptionChainTable chain={chain} /> : null}
          {view === "oi" ? (
            <StrikeOIChart
              strikes={chain.strikes}
              multi={oiQ.data?.oi?.multi_strike ?? chain.multi_strike}
              maxPain={chain.max_pain?.max_pain_strike ?? null}
            />
          ) : null}
          {view === "activity" ? (
            <FinancialTable
              rows={actQ.data?.activity ?? []}
              columns={actCols}
              rowKey={(r, i) => `${r.symbol}-${i}`}
              empty="No option activity samples"
            />
          ) : null}
        </>
      ) : chainQ.status === "ok" ? (
        <ErrorState title="Option chain unavailable" detail="found=false or missing chain payload." />
      ) : null}
    </div>
  );
}
