"use client";

/**
 * Phase 6A selection state, preserved as-is.
 *
 * Market data deliberately does NOT live here. A context value change
 * re-renders every consumer, which is exactly what a 1 Hz market feed must not
 * do — panels read live state through `@/market/hooks` instead (§11, §12).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSymbolTokens } from "@/market/hooks";
import {
  DEFAULT_INSTRUMENT,
  TERMINAL_UNIVERSE,
  UNIVERSE_SYMBOLS,
} from "@/terminal/universe";
import type {
  ActivityFilter,
  StrikeRangeId,
  TerminalInstrument,
  TimeframeId,
  WorkspaceId,
} from "@/terminal/types";

export interface TerminalContextValue {
  instruments: TerminalInstrument[];
  selectedInstrument: TerminalInstrument;
  /** Null until the worker resolves the symbol against the pipeline. */
  selectedToken: number | null;
  tokensBySymbol: Record<string, number>;
  selectedWorkspace: WorkspaceId;
  selectedTimeframe: TimeframeId;
  /** Null means "let the backend choose the nearest expiry". */
  selectedExpiry: string | null;
  selectedStrikeRange: StrikeRangeId;
  favorite: boolean;
  liveScan: boolean;
  activityFilter: ActivityFilter;
  collapsedNav: boolean;
  collapsedWatch: boolean;
  collapsedIntel: boolean;
  setWorkspace: (id: WorkspaceId) => void;
  selectInstrument: (instrument: TerminalInstrument) => void;
  setTimeframe: (tf: TimeframeId) => void;
  setExpiry: (expiry: string | null) => void;
  setStrikeRange: (range: StrikeRangeId) => void;
  toggleFavorite: () => void;
  setLiveScan: (value: boolean) => void;
  setActivityFilter: (value: ActivityFilter) => void;
  toggleNav: () => void;
  toggleWatch: () => void;
  toggleIntel: () => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [selectedInstrument, setSelectedInstrument] =
    useState<TerminalInstrument>(DEFAULT_INSTRUMENT);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceId>("core");
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeId>("5m");
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [selectedStrikeRange, setSelectedStrikeRange] = useState<StrikeRangeId>(10);
  const [favorite, setFavorite] = useState(false);
  const [liveScan, setLiveScan] = useState(true);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [collapsedNav, setCollapsedNav] = useState(false);
  const [collapsedWatch, setCollapsedWatch] = useState(false);
  const [collapsedIntel, setCollapsedIntel] = useState(false);

  const tokensBySymbol = useSymbolTokens(UNIVERSE_SYMBOLS);
  const selectedToken = tokensBySymbol[selectedInstrument.symbol] ?? null;

  const selectInstrument = useCallback((instrument: TerminalInstrument) => {
    setSelectedInstrument(instrument);
    setFavorite(false);
    // Expiries are per-underlying; keeping the old one would query a contract
    // that does not exist for the new instrument.
    setSelectedExpiry(null);
  }, []);

  const value = useMemo<TerminalContextValue>(
    () => ({
      instruments: TERMINAL_UNIVERSE,
      selectedInstrument,
      selectedToken,
      tokensBySymbol,
      selectedWorkspace,
      selectedTimeframe,
      selectedExpiry,
      selectedStrikeRange,
      favorite,
      liveScan,
      activityFilter,
      collapsedNav,
      collapsedWatch,
      collapsedIntel,
      setWorkspace: setSelectedWorkspace,
      selectInstrument,
      setTimeframe: setSelectedTimeframe,
      setExpiry: setSelectedExpiry,
      setStrikeRange: setSelectedStrikeRange,
      toggleFavorite: () => setFavorite((v) => !v),
      setLiveScan,
      setActivityFilter,
      toggleNav: () => setCollapsedNav((v) => !v),
      toggleWatch: () => setCollapsedWatch((v) => !v),
      toggleIntel: () => setCollapsedIntel((v) => !v),
    }),
    [
      selectedInstrument,
      selectedToken,
      tokensBySymbol,
      selectedWorkspace,
      selectedTimeframe,
      selectedExpiry,
      selectedStrikeRange,
      favorite,
      liveScan,
      activityFilter,
      collapsedNav,
      collapsedWatch,
      collapsedIntel,
      selectInstrument,
    ],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error("useTerminal must be used within TerminalProvider");
  return ctx;
}
