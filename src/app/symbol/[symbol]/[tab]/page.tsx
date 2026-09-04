"use client";

import { SymbolTerminal } from "@/components/symbol/SymbolTerminal";
import { useParams } from "next/navigation";

export default function SymbolTabPage() {
  const params = useParams();
  return <SymbolTerminal tab={String(params.tab || "overview")} />;
}
