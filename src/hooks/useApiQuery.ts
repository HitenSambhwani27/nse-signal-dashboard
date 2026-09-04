"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, ApiError } from "@/api/client";

export type QueryStatus = "loading" | "ok" | "error" | "idle";

export interface QueryState<T> {
  status: QueryStatus;
  data: T | null;
  error: string | null;
  updatedAt: number | null;
}

export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

export function useApiQuery<T extends object>(
  path: string | null,
  intervalMs = 5000,
): QueryState<T> & { reload: () => void } {
  const [state, setState] = useState<QueryState<T>>({
    status: path ? "loading" : "idle",
    data: null,
    error: null,
    updatedAt: null,
  });
  const visible = useDocumentVisible();
  const seq = useRef(0);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    const current = pathRef.current;
    if (!current) {
      setState({ status: "idle", data: null, error: null, updatedAt: null });
      return;
    }
    const id = ++seq.current;
    try {
      const data = await apiGet<T>(current);
      if (id !== seq.current) return;
      setState({ status: "ok", data, error: null, updatedAt: Date.now() });
    } catch (err) {
      if (id !== seq.current) return;
      const message =
        err instanceof ApiError ? err.message : "Unable to load market data";
      setState((prev) => ({
        status: "error",
        data: prev.data,
        error: message,
        updatedAt: prev.updatedAt,
      }));
    }
  }, []);

  useEffect(() => {
    seq.current += 1;
    if (!path) {
      setState({ status: "idle", data: null, error: null, updatedAt: null });
      return;
    }
    setState((prev) => ({
      ...prev,
      status: prev.data ? "ok" : "loading",
      error: null,
    }));
    void load();
  }, [path, load]);

  useEffect(() => {
    if (!path || !visible || intervalMs <= 0) return;
    const timer = window.setInterval(() => {
      void load();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [path, visible, intervalMs, load]);

  return { ...state, reload: load };
}
