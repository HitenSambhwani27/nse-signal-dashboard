import { describe, expect, it } from "vitest";
import { SseParser, decodeFrameData } from "@/worker/sse";

describe("SseParser", () => {
  it("emits a frame only once the blank-line terminator arrives", () => {
    const parser = new SseParser();
    expect(parser.feed("event: hello\ndata: {\"a\":1}")).toEqual([]);
    const frames = parser.feed("\n\n");
    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe("hello");
    expect(frames[0].data).toBe('{"a":1}');
  });

  it("reassembles a frame split across arbitrary chunk boundaries", () => {
    const parser = new SseParser();
    parser.feed("id: 7\nev");
    parser.feed("ent: tick\ndata: {\"t\":1,");
    const frames = parser.feed('"seq":7}\n\n');
    expect(frames).toHaveLength(1);
    expect(frames[0].id).toBe("7");
    expect(decodeFrameData(frames[0])).toEqual({ t: 1, seq: 7 });
  });

  it("parses several frames from one chunk and keeps the trailing partial", () => {
    const parser = new SseParser();
    const frames = parser.feed(
      "event: heartbeat\ndata: {}\n\nevent: tick\ndata: {\"t\":2}\n\nevent: par",
    );
    expect(frames.map((f) => f.event)).toEqual(["heartbeat", "tick"]);
    expect(parser.feed("tial\ndata: {}\n\n")[0].event).toBe("partial");
  });

  it("ignores comment lines and tolerates CRLF", () => {
    const parser = new SseParser();
    const frames = parser.feed(": keepalive\r\nevent: session\r\ndata: {\"x\":1}\r\n\r\n");
    expect(frames).toHaveLength(1);
    expect(frames[0].event).toBe("session");
    expect(decodeFrameData(frames[0])).toEqual({ x: 1 });
  });

  it("defaults the event name and joins multi-line data", () => {
    const parser = new SseParser();
    const [frame] = parser.feed("data: line1\ndata: line2\n\n");
    expect(frame.event).toBe("message");
    expect(frame.data).toBe("line1\nline2");
  });

  it("returns null for malformed or non-object JSON rather than throwing", () => {
    const parser = new SseParser();
    const [bad] = parser.feed("event: tick\ndata: {not json\n\n");
    expect(decodeFrameData(bad)).toBeNull();
    const [arr] = parser.feed("event: tick\ndata: [1,2]\n\n");
    expect(decodeFrameData(arr)).toBeNull();
  });
});
