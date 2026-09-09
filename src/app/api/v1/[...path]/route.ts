import { NextRequest, NextResponse } from "next/server";
import { upstreamOrigin } from "@/api/upstream";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path[0] === "stream") {
    return new NextResponse(
      JSON.stringify({
        error: "use_dedicated_stream_route",
        detail: "GET /api/v1/stream is the unbuffered SSE proxy",
      }),
      { status: 308, headers: { location: `/api/v1/stream${request.nextUrl.search}` } },
    );
  }
  const encoded = path.map((segment) => encodeURIComponent(segment)).join("/");
  const url = `${upstreamOrigin()}/api/v1/${encoded}${request.nextUrl.search}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "upstream unreachable";
    return NextResponse.json(
      {
        error: "upstream_unreachable",
        detail,
        upstream: url,
      },
      { status: 502 },
    );
  }
}
