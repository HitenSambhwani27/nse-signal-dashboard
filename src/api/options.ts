import { apiGet, encodePathSegment } from "@/api/client";
import type {
  OptionActivityResponse,
  OptionChainResponse,
  OptionOiResponse,
} from "@/api/types";

export function optionsPath(underlying: string, expiry?: string | null): string {
  const u = encodePathSegment(underlying);
  if (expiry) return `/api/v1/options/${u}/${encodePathSegment(expiry)}`;
  return `/api/v1/options/${u}`;
}

export function optionsOiPath(underlying: string, expiry: string): string {
  return `/api/v1/options/${encodePathSegment(underlying)}/${encodePathSegment(expiry)}/oi`;
}

export function optionsActivityPath(underlying: string, expiry: string): string {
  return `/api/v1/options/${encodePathSegment(underlying)}/${encodePathSegment(expiry)}/activity`;
}

export function fetchOptionChain(
  underlying: string,
  expiry?: string | null,
  signal?: AbortSignal,
): Promise<OptionChainResponse> {
  return apiGet<OptionChainResponse>(optionsPath(underlying, expiry), { signal });
}

export function fetchOptionOi(
  underlying: string,
  expiry: string,
  signal?: AbortSignal,
): Promise<OptionOiResponse> {
  return apiGet<OptionOiResponse>(optionsOiPath(underlying, expiry), { signal });
}

export function fetchOptionActivity(
  underlying: string,
  expiry: string,
  signal?: AbortSignal,
): Promise<OptionActivityResponse> {
  return apiGet<OptionActivityResponse>(optionsActivityPath(underlying, expiry), { signal });
}
