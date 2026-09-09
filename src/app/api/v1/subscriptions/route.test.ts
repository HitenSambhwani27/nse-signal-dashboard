// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("subscriptions proxy", () => {
  it("POSTs JSON to the pipeline control path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, status: "pending" }),
      headers: new Headers({ "content-type": "application/json" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/v1/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: 1,
          requester: "phase5",
          action: "subscribe",
          capabilities: ["price"],
        }),
      }),
    );
    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/subscriptions");
  });
});
