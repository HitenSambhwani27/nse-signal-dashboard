import { describe, expect, it, vi, afterEach } from "vitest";
import { apiGet, clearApiCache, encodePathSegment } from "@/api/client";
import { EnvelopeError } from "@/api/envelope";

afterEach(() => {
  clearApiCache();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("parses a maturity envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          maturity: { equity: { display: "insufficient data, 2/60 pooled days", probability: null } },
          as_of: "2026-09-04T00:00:00Z",
          found: false,
          quote: null,
        }),
      }),
    );
    const payload = await apiGet<{ found: boolean; quote: null }>("/api/v1/quotes/RELIANCE");
    expect(payload.found).toBe(false);
    expect(payload.quote).toBeNull();
  });

  it("rejects payloads without maturity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ last_price: 1 }),
      }),
    );
    await expect(apiGet("/api/v1/quotes/X")).rejects.toBeInstanceOf(EnvelopeError);
  });

  it("encodes spaces once", () => {
    expect(encodePathSegment("NIFTY 50")).toBe("NIFTY%2050");
    expect(encodePathSegment("NIFTY%2050")).toBe("NIFTY%2050");
    expect(encodePathSegment("NIFTY BANK")).toBe("NIFTY%20BANK");
  });
});
