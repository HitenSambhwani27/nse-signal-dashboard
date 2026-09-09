/**
 * Phase 4 subscription control proxy. REST only — not a market-data stream.
 */
import { upstreamOrigin } from "@/api/upstream";

export const dynamic = "force-dynamic";

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
