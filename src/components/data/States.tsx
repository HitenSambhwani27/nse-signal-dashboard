export function LoadingState({ label = "Loading market data" }: { label?: string }) {
  return (
    <div className="state" role="status">
      <h3>{label}</h3>
      <div className="skel" style={{ width: 180, marginTop: 10 }} />
      <div className="skel" style={{ width: 240, marginTop: 8 }} />
    </div>
  );
}

export function EmptyState({
  title = "No market activity available",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load market data",
  detail,
}: {
  title?: string;
  detail?: string | null;
}) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function InsufficientDataState({
  display,
}: {
  display?: string | null;
}) {
  return (
    <div className="state">
      <h3>Insufficient data</h3>
      <p>{display || "Insufficient data, N/60 pooled days"}</p>
    </div>
  );
}

export function ClosedState() {
  return (
    <EmptyState
      title="Market closed"
      detail="No new ticks are expected until the cash session. Existing backend snapshots remain on screen when available."
    />
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap">
      <table className="fin">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skel" style={{ width: 48 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}>
                  <div className="skel" style={{ width: c === 0 ? 72 : 48 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
