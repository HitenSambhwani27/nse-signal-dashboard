/**
 * Phase 4 subscription control proxy. REST only — not a market-data stream.
 */
export const dynamic = "force-dynamic";

function upstreamOrigin(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NSE_API_URL ||
    "http://127.0.0.1:8080";
  if (["mock", "fixture", "fixtures", ""].includes(raw.trim().toLowerCase())) {
    return "http://127.0.0.1:8080";
  }
  return raw.replace(/\/$/, "");
}

export async function POST(request: Request) {
  const target = `${upstreamOrigin()}/api/v1/subscriptions`;
  try {
    const upstream = await fetch(target, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "content-type": request.headers.get("content-type") || "application/json",
      },
      body: await request.text(),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "upstream unreachable";
    return Response.json(
      { error: "upstream_unreachable", detail, upstream: target },
      { status: 502 },
    );
  }
}
