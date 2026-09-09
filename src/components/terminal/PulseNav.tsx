"use client";

import type { ReactNode } from "react";
import type { WorkspaceId } from "@/terminal/types";
import { useTerminal } from "@/terminal/context";

const ITEMS: {
  id: WorkspaceId | "marketwatch";
  label: string;
  icon: ReactNode;
}[] = [
  { id: "marketwatch", label: "Marketwatch", icon: <ListIcon /> },
  { id: "core", label: "Workspace", icon: <GridIcon /> },
  { id: "options", label: "Options", icon: <ChainIcon /> },
  { id: "futures", label: "Futures", icon: <CurveIcon /> },
  { id: "activity", label: "Activity", icon: <PulseIcon /> },
  { id: "intelligence", label: "Intelligence", icon: <BrainIcon /> },
  { id: "screener", label: "Screener", icon: <FilterIcon /> },
  { id: "alerts", label: "Alerts", icon: <AlertIcon /> },
  { id: "portfolio", label: "Portfolio", icon: <BriefIcon /> },
];

export function PulseNav() {
  const { selectedWorkspace, setWorkspace, collapsedNav, collapsedWatch, toggleWatch } =
    useTerminal();
  return (
    <nav className={`pulse-nav ${collapsedNav ? "collapsed" : ""}`} aria-label="Workspace">
      <div className="pulse-nav-kicker">WORKSPACE</div>
      {ITEMS.map((item) => {
        const active = item.id === "marketwatch" ? false : selectedWorkspace === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`pulse-nav-item ${active ? "active" : ""}`}
            onClick={() => {
              if (item.id === "marketwatch") {
                if (collapsedWatch) toggleWatch();
                setWorkspace("core");
                return;
              }
              setWorkspace(item.id);
            }}
          >
            <span className="pulse-nav-ico" aria-hidden>
              {item.icon}
            </span>
            <span className="pulse-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}
function ChainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 007.07 0l2.12-2.12a5 5 0 00-7.07-7.07L10.7 5.24" />
      <path d="M14 11a5 5 0 00-7.07 0L4.8 13.12a5 5 0 107.07 7.07l1.42-1.41" />
    </svg>
  );
}
function CurveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19h16M5 16c4-8 6-3 9-9 1.5 3 3 5 6 5" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12h4l2-6 4 12 3-7h4" />
    </svg>
  );
}
function BrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h16l-6 8v5l-4 2v-7L4 5z" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 4.3L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />
    </svg>
  );
}
function BriefIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="1" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}
