// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function proxyGet(path: string[], search = "") {
  const suffix = path.map(encodeURIComponent).join("/");
  const request = new NextRequest(`http://localhost/api/v1/${suffix}${search}`);
  return GET(request, { params: Promise.resolve({ path }) });
}

describe("REST proxy", () => {
  it("forwards quotes, options, futures, activity, and candles to API_BASE_URL", async () => {
    const previous = process.env.API_BASE_URL;
    process.env.API_BASE_URL = "http://127.0.0.1:18080";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
      headers: new Headers({ "content-type": "application/json" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const cases: Array<{ path: string[]; search?: string; expected: string }> = [
        { path: ["quotes", "NIFTY 50"], expected: "http://127.0.0.1:18080/api/v1/quotes/NIFTY%2050" },
        { path: ["options", "NIFTY"], expected: "http://127.0.0.1:18080/api/v1/options/NIFTY" },
        { path: ["futures", "NIFTY"], expected: "http://127.0.0.1:18080/api/v1/futures/NIFTY" },
        {
          path: ["unusual-activity"],
          search: "?limit=50",
          expected: "http://127.0.0.1:18080/api/v1/unusual-activity?limit=50",
        },
        {
          path: ["candles", "NIFTY 50"],
          search: "?interval=5m",
          expected: "http://127.0.0.1:18080/api/v1/candles/NIFTY%2050?interval=5m",
        },
      ];
      for (const item of cases) {
        fetchMock.mockClear();
        const response = await proxyGet(item.path, item.search ?? "");
        expect(response.status).toBe(200);
        expect(String(fetchMock.mock.calls[0][0])).toBe(item.expected);
      }
    } finally {
      if (previous === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = previous;
    }
  });
});
