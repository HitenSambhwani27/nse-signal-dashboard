"use client";

import type { WorkspaceId } from "@/terminal/types";
import { useTerminal } from "@/terminal/context";

const TABS: { id: WorkspaceId; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "options", label: "Options" },
  { id: "futures", label: "Futures" },
  { id: "activity", label: "Activity" },
  { id: "intelligence", label: "Intelligence" },
  { id: "momentum", label: "Momentum" },
];

export function WorkspaceBar() {
  const { selectedWorkspace, setWorkspace } = useTerminal();
  return (
    <div className="pulse-wsbar">
      <label className="pulse-ws-select">
        <span>ACTIVE WORKSPACE</span>
        <select
          value={selectedWorkspace}
          onChange={(e) => setWorkspace(e.target.value as WorkspaceId)}
          aria-label="Active workspace"
        >
          <option value="core">Intraday / Core</option>
          <option value="options">Intraday / Options</option>
          <option value="futures">Intraday / Futures</option>
          <option value="activity">Intraday / Activity</option>
          <option value="intelligence">Intraday / Intelligence</option>
          <option value="momentum">Intraday / Momentum</option>
          <option value="screener">Screener</option>
          <option value="alerts">Alerts</option>
          <option value="portfolio">Portfolio</option>
        </select>
      </label>
      <div className="pulse-tabs" role="tablist" aria-label="Center workspace">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selectedWorkspace === tab.id}
            className={`pulse-tab ${selectedWorkspace === tab.id ? "active" : ""}`}
            onClick={() => setWorkspace(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" className="pulse-tab ghost" aria-label="New workspace" disabled>
          + New
        </button>
      </div>
      <div className="pulse-ws-tools">
        <span>Layout</span>
        <span>View</span>
        <span aria-hidden>⋯</span>
      </div>
    </div>
  );
}
