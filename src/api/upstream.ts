/**
 * Server-side FastAPI origin for Next.js `/api/v1/*` proxies.
 *
 * Browser and SharedWorker always call same-origin `/api/v1/*`. Only this
 * module reads the upstream environment variables.
 *
 * Resolution order:
 *   1. `API_BASE_URL` (preferred)
 *   2. `NEXT_PUBLIC_API_BASE_URL` (legacy; leave empty so the browser stays same-origin)
 *   3. `NSE_API_URL` (legacy Streamlit / pytest client)
 *   4. `DEFAULT_API_BASE_URL`
 *
 * Default `http://127.0.0.1:8080` is local FastAPI with no SSH tunnel.
 * For a VM tunnel (Windows `localhost:18080` → VM `127.0.0.1:8080`) set:
 *   API_BASE_URL=http://127.0.0.1:18080
 */

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080";

const FIXTURE_SENTINELS = new Set(["mock", "fixture", "fixtures", ""]);

export function upstreamOrigin(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NSE_API_URL ||
    DEFAULT_API_BASE_URL;
  if (FIXTURE_SENTINELS.has(raw.trim().toLowerCase())) {
    return DEFAULT_API_BASE_URL;
  }
  return raw.replace(/\/$/, "");
}
