import { EnvelopeError, parseEnvelope } from "@/api/envelope";

export const DEFAULT_BACKEND = "http://127.0.0.1:8080";
export const REQUEST_TIMEOUT_MS = 15_000;

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

export async function apiGet<T extends object>(
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
      throw new ApiError(`Unable to load market data (${response.status})`, response.status, path);
    }
    const payload: unknown = await response.json();
    return parseEnvelope<T>(payload);
  } catch (err) {
    if (err instanceof ApiError || err instanceof EnvelopeError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timed out", 408, path);
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Unable to load market data",
      0,
      path,
    );
  } finally {
    clearTimeout(timer);
  }
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
