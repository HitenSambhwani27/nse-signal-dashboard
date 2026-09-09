/**
 * Incremental text/event-stream parser.
 *
 * Chunk boundaries are arbitrary, so this buffers until a blank line closes a
 * frame. Comment lines (`:`) are ignored per the SSE spec.
 */

export interface SseFrame {
  event: string;
  data: string;
  /** Only Phase 5 `tick` frames carry an id (the global `seq`). */
  id: string | null;
  retryMs: number | null;
}

export class SseParser {
  private buffer = "";

  feed(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];
    // Tolerate \r\n even though the backend writes \n.
    let boundary = this.nextBoundary();
    while (boundary !== null) {
      const raw = this.buffer.slice(0, boundary.index);
      this.buffer = this.buffer.slice(boundary.index + boundary.length);
      const frame = parseBlock(raw);
      if (frame) frames.push(frame);
      boundary = this.nextBoundary();
    }
    return frames;
  }

  reset(): void {
    this.buffer = "";
  }

  private nextBoundary(): { index: number; length: number } | null {
    const lf = this.buffer.indexOf("\n\n");
    const crlf = this.buffer.indexOf("\r\n\r\n");
    if (lf === -1 && crlf === -1) return null;
    if (crlf !== -1 && (lf === -1 || crlf < lf)) return { index: crlf, length: 4 };
    return { index: lf, length: 2 };
  }
}

function parseBlock(raw: string): SseFrame | null {
  let event = "message";
  let id: string | null = null;
  let retryMs: number | null = null;
  const dataLines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        dataLines.push(value);
        break;
      case "id":
        id = value;
        break;
      case "retry": {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) retryMs = parsed;
        break;
      }
      default:
        break;
    }
  }

  if (dataLines.length === 0 && retryMs === null) return null;
  return { event, data: dataLines.join("\n"), id, retryMs };
}

/** Parse a frame's `data` payload. Malformed JSON yields null rather than throwing (§32). */
export function decodeFrameData(frame: SseFrame): Record<string, unknown> | null {
  if (frame.data === "") return null;
  try {
    const parsed: unknown = JSON.parse(frame.data);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
