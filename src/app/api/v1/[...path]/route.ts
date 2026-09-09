import { NextRequest, NextResponse } from "next/server";

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
