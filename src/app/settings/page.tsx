"use client";

import { apiBaseUrl } from "@/api/client";
import { accountPath, decisionsPath, healthPath, maturityPath, overviewPath, signalsPath } from "@/api/pipeline";
import { maturityViews, probabilityCell } from "@/api/envelope";
import type {
  AccountResponse,
  DecisionsResponse,
  HealthResponse,
  MaturityResponse,
  OverviewResponse,
  SignalsResponse,
} from "@/api/types";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { MetricCard } from "@/components/data/MetricCard";
import { ErrorState, LoadingState } from "@/components/data/States";
import { FinancialTable, type Column } from "@/components/tables/FinancialTable";
import { useApiQuery } from "@/hooks/useApiQuery";
import type { SignalRow } from "@/api/types";

export default function SettingsPage() {
  const health = useApiQuery<HealthResponse>(healthPath(), 10_000);
  const maturity = useApiQuery<MaturityResponse>(maturityPath(), 15_000);
  const overview = useApiQuery<OverviewResponse>(overviewPath(), 15_000);
  const signals = useApiQuery<SignalsResponse>(signalsPath(), 15_000);
  const account = useApiQuery<AccountResponse>(accountPath(), 30_000);
  const decisions = useApiQuery<DecisionsResponse>(decisionsPath(), 30_000);
  const views = maturityViews(maturity.data?.maturity ?? health.data?.maturity);
  const signalCols: Column<SignalRow>[] = [
    { key: "ts", header: "Timestamp", render: (r) => r.timestamp ?? "—" },
    { key: "s", header: "Symbol", render: (r) => r.symbol ?? "—" },
    { key: "t", header: "Track", render: (r) => r.track ?? "—" },
    { key: "p", header: "Probability", render: (r) => probabilityCell(r) },
    { key: "tier", header: "Tier", render: (r) => r.tier ?? "—" },
  ];
  const proxy = apiBaseUrl() || "same-origin rewrite → API_BASE_URL";
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Connection, maturity gate, and pipeline read models. Client profile is a placeholder.</p>
        </div>
        <DataFreshnessBadge asOf={health.data?.as_of} />
      </div>
      <div className="grid-4">
        <MetricCard label="API origin" value={proxy} />
        <MetricCard label="Health" value={health.data?.health?.api ?? health.status} />
        <MetricCard label="Database" value={health.data?.health?.database ?? "—"} />
        <MetricCard label="Instrument cache" value={health.data?.health?.instrument_cache?.status ?? "—"} />
        <MetricCard label="User" value="Client (unauthenticated)" />
        <MetricCard label="Polling" value="Visible-tab only" />
      </div>
      <section className="panel">
        <div className="panel-h">Maturity (60 pooled live days)</div>
        <div className="panel-b">
          {maturity.status === "loading" && !maturity.data ? (
            <LoadingState />
          ) : (
            <div className="grid-2">
              {views.map((v) => (
                <div
                  key={v.envelope_key || [v.class_key, v.underlying].filter(Boolean).join("-") || "row"}
                  className="index-card"
                >
                  <div>
                    <div className="name">{v.class_key}</div>
                    <div>{v.display}</div>
                  </div>
                  <div className="page-sub">{v.tier}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      {health.status === "error" ? <ErrorState detail={health.error} /> : null}
      <section className="panel">
        <div className="panel-h">Pipeline overview</div>
        <div className="panel-b grid-4">
          <MetricCard label="Last ingest" value={overview.data?.last_ingest?.timestamp ?? "—"} />
          <MetricCard label="Last feature" value={String(overview.data?.last_feature ?? "—")} />
          <MetricCard label="Last signal" value={String(overview.data?.last_signal ?? "—")} />
          <MetricCard label="Signals" value={String(overview.data?.signal_counts?.total ?? "—")} />
        </div>
      </section>
      <section className="panel">
        <div className="panel-h">Signals (probability gated)</div>
        <FinancialTable
          rows={signals.data?.signals ?? []}
          columns={signalCols}
          rowKey={(r, i) => String(r.id ?? i)}
          empty="No live-engine signal rows yet"
        />
      </section>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-h">Account</div>
          <div className="panel-b">
            <pre style={{ whiteSpace: "pre-wrap", color: "var(--text-muted)", fontSize: 11 }}>
              {JSON.stringify(
                {
                  positions: account.data?.positions ?? null,
                  margins: account.data?.margins ?? null,
                  fills: account.data?.fills ?? [],
                },
                null,
                2,
              )}
            </pre>
          </div>
        </section>
        <section className="panel">
          <div className="panel-h">Decisions</div>
          <div className="panel-b">
            <pre style={{ whiteSpace: "pre-wrap", color: "var(--text-muted)", fontSize: 11 }}>
              {JSON.stringify(
                {
                  decisions: decisions.data?.decisions ?? [],
                  class_counts: decisions.data?.class_counts ?? {},
                },
                null,
                2,
              )}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
