"use client";

import type { ReactNode } from "react";

export function ChartPanel({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-h">
        <span>{title}</span>
        {extra}
      </div>
      {children}
    </section>
  );
}
