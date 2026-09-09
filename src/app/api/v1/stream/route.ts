/**
 * Phase 4 SSE proxy. Do not use [...path] (it buffers response.text() + 20s timeout).
 * SharedWorker / MarketCache / terminal UI stay out of scope.
 */
import { upstreamOrigin } from "@/api/upstream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const target = `${upstreamOrigin()}/api/v1/stream${new URL(request.url).search}`;
  const headers = new Headers();
  headers.set("Accept", "text/event-stream");
  const lastEventId =
    request.headers.get("last-event-id") ?? request.headers.get("Last-Event-ID");
  if (lastEventId) {
    headers.set("Last-Event-ID", lastEventId);
  }

  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") || "application/json",
          "cache-control": "no-store",
          "retry-after": upstream.headers.get("retry-after") || "",
        },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "x-accel-buffering": "no",
        connection: "keep-alive",
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
