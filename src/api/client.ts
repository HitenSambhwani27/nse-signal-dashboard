import { EnvelopeError, parseEnvelope } from "@/api/envelope";
import { normalizeSymbol } from "@/lib/instruments";

export const REQUEST_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 1_500;

export class ApiError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

export function apiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (raw == null || raw.trim() === "") return "";
  if (["mock", "fixture", "fixtures"].includes(raw.trim().toLowerCase())) return "";
  return raw.replace(/\/$/, "");
}

export function joinUrl(path: string): string {
  const base = apiBaseUrl();
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalised}`;
}

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { at: number; data: unknown }>();

export function clearApiCache(): void {
  inflight.clear();
  cache.clear();
}

export async function apiGet<T extends object>(
  path: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const url = joinUrl(path);
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data as T;
  }
  const existing = inflight.get(url);
  if (existing && !options?.signal) {
    return existing as Promise<T>;
  }
  const pending = apiGetUncached<T>(path, options);
  if (!options?.signal) inflight.set(url, pending);
  try {
    const data = await pending;
    cache.set(url, { at: Date.now(), data });
    return data;
  } finally {
    inflight.delete(url);
  }
}

async function apiGetUncached<T extends object>(
  path: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  const url = joinUrl(path);
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (options?.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = `Unable to load market data (${response.status})`;
      try {
        const errBody: unknown = await response.clone().json();
        if (errBody && typeof errBody === "object" && "detail" in errBody) {
          const text = String((errBody as { detail?: unknown }).detail || "");
          if (text.includes("ECONNREFUSED") || response.status === 502) {
            detail = "API unreachable";
          }
        }
      } catch {
        /* keep status message */
      }
      throw new ApiError(detail, response.status, path);
    }
    const payload: unknown = await response.json();
    return parseEnvelope<T>(payload);
  } catch (err) {
    if (err instanceof ApiError || err instanceof EnvelopeError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out", 408, path);
    }
    const message = err instanceof Error ? err.message : "Unable to load market data";
    if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch")) {
      throw new ApiError("API unreachable", 0, path);
    }
    throw new ApiError(message, 0, path);
  } finally {
    clearTimeout(timer);
  }
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(normalizeSymbol(value));
}
