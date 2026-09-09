"use client";

import { ActivityWorkspace } from "@/components/terminal/ActivityWorkspace";
import { CoreWorkspace } from "@/components/terminal/CoreWorkspace";
import { FuturesWorkspace } from "@/components/terminal/FuturesWorkspace";
import { IntelligenceWorkspace, PlaceholderWorkspace } from "@/components/terminal/IntelligenceWorkspace";
import { MarketwatchPanel } from "@/components/terminal/MarketwatchPanel";
import { OptionsWorkspace } from "@/components/terminal/OptionsWorkspace";
import { PulseHeader } from "@/components/terminal/PulseHeader";
import { PulseNav } from "@/components/terminal/PulseNav";
import { TradeIntelligencePanel } from "@/components/terminal/TradeIntelligencePanel";
import { WorkspaceBar } from "@/components/terminal/WorkspaceBar";
import { TerminalProvider, useTerminal } from "@/terminal/context";

export function PulseTerminal() {
  return (
    <TerminalProvider>
      <PulseTerminalShell />
    </TerminalProvider>
  );
}

function PulseTerminalShell() {
  const { selectedWorkspace, collapsedNav, collapsedWatch, collapsedIntel } = useTerminal();
  return (
    <div
      className={[
        "pulse-terminal",
        collapsedNav ? "nav-collapsed" : "",
        collapsedWatch ? "watch-collapsed" : "",
        collapsedIntel ? "intel-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <PulseHeader />
      <WorkspaceBar />
      <PulseNav />
      <MarketwatchPanel />
      <main className="pulse-center" id="pulse-center">
        {selectedWorkspace === "core" ? <CoreWorkspace /> : null}
        {selectedWorkspace === "options" ? <OptionsWorkspace /> : null}
        {selectedWorkspace === "futures" ? <FuturesWorkspace /> : null}
        {selectedWorkspace === "activity" ? <ActivityWorkspace /> : null}
        {selectedWorkspace === "intelligence" ? <IntelligenceWorkspace /> : null}
        {selectedWorkspace === "momentum" ? (
          <PlaceholderWorkspace workspace="momentum" title="Momentum" />
        ) : null}
        {selectedWorkspace === "screener" ? (
          <PlaceholderWorkspace workspace="screener" title="Screener" />
        ) : null}
        {selectedWorkspace === "alerts" ? (
          <PlaceholderWorkspace workspace="alerts" title="Alerts" />
        ) : null}
        {selectedWorkspace === "portfolio" ? (
          <PlaceholderWorkspace workspace="portfolio" title="Portfolio" />
        ) : null}
      </main>
      <TradeIntelligencePanel />
    </div>
  );
}
