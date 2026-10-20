"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import type { ReactNode } from "react";
import { Skeleton } from "./ui";
import { t } from "@/lib/i18n";
import { dateFmt } from "@/lib/formatNum";

const EChart = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> });

export function ChartFrame({
  title,
  note,
  children,
  hint,
}: {
  title: string;
  note?: string | null;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <section className="card flex flex-col p-4">
      <div className="mb-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {note ? <p className="mt-0.5 text-[11px] text-muted">{note}</p> : null}
      </div>
      <div className="min-h-40 flex-1">{children}</div>
      {hint ? <p className="mt-2 text-[10px] text-muted">{hint}</p> : null}
    </section>
  );
}

export type Envelope<T> = {
  n: number;
  insufficientData: boolean;
  data: T | null;
  lastUpdated: string;
};

export function ChartCard({
  title,
  stat,
  note,
  render,
  hint,
}: {
  title: string;
  stat?: Envelope<unknown>;
  note?: string;
  render: (data: unknown) => EChartsOption;
  hint?: string;
}) {
  if (!stat) {
    return (
      <ChartFrame title={title} note={note} hint={hint}>
        <Skeleton className="h-40 w-full" />
      </ChartFrame>
    );
  }
  if (stat.insufficientData || !stat.data) {
    return (
      <ChartFrame title={title} note={note} hint={hint}>
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] p-3 text-center">
          <p className="text-sm font-semibold">{t.dashboard.notEnough}</p>
          <p className="text-xs text-muted">{t.dashboard.notEnoughHint(stat.n)}</p>
        </div>
      </ChartFrame>
    );
  }
  const option = render(stat.data);
  return (
    <ChartFrame title={title} note={note} hint={`${t.dashboard.n}${stat.n} · ${t.dashboard.lastUpdated} ${dateFmt(stat.lastUpdated)}`}>
      <EChart option={option} notMerge={false} style={{ height: "100%", width: "100%" }} />
    </ChartFrame>
  );
}
