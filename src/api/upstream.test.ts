import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_API_BASE_URL, upstreamOrigin } from "@/api/upstream";

const KEYS = ["API_BASE_URL", "NEXT_PUBLIC_API_BASE_URL", "NSE_API_URL"] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) original[key] = process.env[key];
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("upstreamOrigin", () => {
  it("defaults to local FastAPI :8080 when no env is set", () => {
    expect(upstreamOrigin()).toBe(DEFAULT_API_BASE_URL);
    expect(upstreamOrigin()).toBe("http://127.0.0.1:8080");
  });

  it("uses API_BASE_URL for a VM tunnel on 18080", () => {
    process.env.API_BASE_URL = "http://127.0.0.1:18080";
    expect(upstreamOrigin()).toBe("http://127.0.0.1:18080");
  });

  it("keeps a direct local :8080 configuration", () => {
    process.env.API_BASE_URL = "http://127.0.0.1:8080";
    expect(upstreamOrigin()).toBe("http://127.0.0.1:8080");
  });

  it("strips a trailing slash", () => {
    process.env.API_BASE_URL = "http://127.0.0.1:18080/";
    expect(upstreamOrigin()).toBe("http://127.0.0.1:18080");
  });

  it("prefers API_BASE_URL over legacy fallbacks", () => {
    process.env.API_BASE_URL = "http://127.0.0.1:18080";
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://127.0.0.1:9999";
    process.env.NSE_API_URL = "http://127.0.0.1:8080";
    expect(upstreamOrigin()).toBe("http://127.0.0.1:18080");
  });
});
