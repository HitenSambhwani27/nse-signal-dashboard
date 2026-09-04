"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { futuresPath } from "@/api/futures";
import type { FuturesResponse } from "@/api/types";
import { DataFreshnessBadge } from "@/components/data/Badges";
import { ErrorState, LoadingState } from "@/components/data/States";
import { FuturesPanel } from "@/components/futures/FuturesPanel";
import { useApiQuery } from "@/hooks/useApiQuery";
import { INDEX_INSTRUMENTS, decodeParam, underlyingForSymbol } from "@/lib/instruments";

export default function FuturesPage() {
  const params = useParams();
  const underlying = underlyingForSymbol(decodeParam(params.underlying as string) || "NIFTY");
  const q = useApiQuery<FuturesResponse>(futuresPath(underlying), 5000);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="page-title">{underlying} futures</h1>
          <p className="page-sub">GET /api/v1/futures/{underlying}. Price/OI labels are backend-inferred, not position proof.</p>
        </div>
        <div className="row">
          {INDEX_INSTRUMENTS.map((i) => (
            <Link
              key={i.underlying}
              className={`btn ${i.underlying === underlying ? "active" : ""}`}
              href={`/futures/${i.underlying}`}
            >
              {i.label}
            </Link>
          ))}
          <DataFreshnessBadge asOf={q.data?.as_of} />
        </div>
      </div>
      {q.status === "error" && !q.data ? <ErrorState detail={q.error} /> : null}
      {q.status === "loading" && !q.data ? <LoadingState /> : <FuturesPanel book={q.data?.futures ?? null} />}
    </div>
  );
}
