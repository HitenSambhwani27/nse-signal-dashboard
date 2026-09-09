"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PHASE6A_DEFAULT_INSTRUMENT,
  PHASE6A_ACTIVITY,
  PHASE6A_MARKETWATCH,
  phase6aCoreSnapshot,
  phase6aFutures,
  phase6aIntelligence,
  phase6aOptions,
} from "@/fixtures/phase6a";
import type {
  ActivitySnapshot,
  CoreSnapshot,
  FuturesSnapshot,
  IntelligenceSnapshot,
  OptionsSnapshot,
  StrikeRangeId,
  TerminalInstrument,
  TimeframeId,
  WorkspaceId,
} from "@/terminal/types";

export interface TerminalContextValue {
  selectedInstrument: TerminalInstrument;
  selectedWorkspace: WorkspaceId;
  selectedTimeframe: TimeframeId;
  selectedExpiry: string;
  selectedStrikeRange: StrikeRangeId;
  favorite: boolean;
  liveScan: boolean;
  activityFilter: "all" | "positive" | "negative" | "neutral";
  collapsedNav: boolean;
  collapsedWatch: boolean;
  collapsedIntel: boolean;
  core: CoreSnapshot;
  options: OptionsSnapshot;
  futures: FuturesSnapshot;
  activity: ActivitySnapshot;
  intelligence: IntelligenceSnapshot;
  setWorkspace: (id: WorkspaceId) => void;
  selectInstrument: (instrument: TerminalInstrument) => void;
  setTimeframe: (tf: TimeframeId) => void;
  setExpiry: (expiry: string) => void;
  setStrikeRange: (range: StrikeRangeId) => void;
  toggleFavorite: () => void;
  setLiveScan: (value: boolean) => void;
  setActivityFilter: (value: "all" | "positive" | "negative" | "neutral") => void;
  toggleNav: () => void;
  toggleWatch: () => void;
  toggleIntel: () => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [selectedInstrument, setSelectedInstrument] = useState<TerminalInstrument>(
    PHASE6A_DEFAULT_INSTRUMENT,
  );
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceId>("core");
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeId>("5m");
  const [selectedStrikeRange, setSelectedStrikeRange] = useState<StrikeRangeId>(10);
  const [favorite, setFavorite] = useState(false);
  const [liveScan, setLiveScan] = useState(true);
  const [activityFilter, setActivityFilter] = useState<"all" | "positive" | "negative" | "neutral">(
    "all",
  );
  const [collapsedNav, setCollapsedNav] = useState(false);
  const [collapsedWatch, setCollapsedWatch] = useState(false);
  const [collapsedIntel, setCollapsedIntel] = useState(false);

  const core = useMemo(() => phase6aCoreSnapshot(selectedInstrument), [selectedInstrument]);
  const optionsFull = useMemo(() => phase6aOptions(core.ltp), [core.ltp]);
  const [selectedExpiry, setSelectedExpiry] = useState(optionsFull.selectedExpiry);
  const options = useMemo(() => {
    const atm = optionsFull.rows.find((r) => r.atm)?.strike;
    const rows = optionsFull.rows.filter((row) => {
      if (atm == null) return true;
      return Math.abs(row.strike - atm) <= selectedStrikeRange * 50;
    });
    return { ...optionsFull, selectedExpiry, rows };
  }, [optionsFull, selectedExpiry, selectedStrikeRange]);
  const futures = useMemo(
    () => phase6aFutures(selectedInstrument.symbol, core.ltp),
    [selectedInstrument.symbol, core.ltp],
  );
  const activity = PHASE6A_ACTIVITY;
  const intelligence = useMemo(
    () => phase6aIntelligence(selectedInstrument),
    [selectedInstrument],
  );

  const selectInstrument = useCallback((instrument: TerminalInstrument) => {
    setSelectedInstrument(instrument);
    setFavorite(false);
  }, []);

  const value = useMemo<TerminalContextValue>(
    () => ({
      selectedInstrument,
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
      core,
      options,
      futures,
      activity,
      intelligence,
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
      core,
      options,
      futures,
      activity,
      intelligence,
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

export function instrumentFromWatchlist(symbol: string): TerminalInstrument | undefined {
  return PHASE6A_MARKETWATCH.find((row) => row.instrument.symbol === symbol)?.instrument;
}
