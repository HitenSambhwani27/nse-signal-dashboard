// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { upstreamOrigin } from "@/api/upstream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SSE proxy", () => {
  it("forwards Last-Event-ID and does not buffer the upstream body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({ "content-type": "text/event-stream" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/v1/stream?tokens=256265", {
      headers: { "Last-Event-ID": "42" },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Last-Event-ID")).toBe("42");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${upstreamOrigin()}/api/v1/stream?tokens=256265`,
    );
  });

  it("passes through 503 Retry-After from admission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      body: null,
      status: 503,
      text: async () => JSON.stringify({ reason: "stream_capacity_exceeded" }),
      headers: new Headers({
        "content-type": "application/json",
        "retry-after": "5",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(
      new Request("http://localhost/api/v1/stream?tokens=1"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
  });

  it("sends the stream to API_BASE_URL including a tunnel port", async () => {
    const previous = process.env.API_BASE_URL;
    process.env.API_BASE_URL = "http://127.0.0.1:18080";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({ "content-type": "text/event-stream" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      await GET(new Request("http://localhost/api/v1/stream?tokens=256265"));
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        "http://127.0.0.1:18080/api/v1/stream?tokens=256265",
      );
    } finally {
      if (previous === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = previous;
    }
  });
});
