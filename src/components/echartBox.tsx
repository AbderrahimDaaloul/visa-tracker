"use client";

// Client-only ECharts host, reusable across widgets.
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import { Skeleton } from "./ui";

const EChart = dynamic(() => import("echarts-for-react"), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

export function EChartBox({ option, height }: { option: EChartsOption; height?: string }) {
  return (
    <div style={{ height: height ?? "100%" }}>
      <EChart option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
