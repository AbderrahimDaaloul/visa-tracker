import type { EChartsOption } from "echarts";

export const PAL = ["#2563eb", "#ea580c", "#0f766e", "#a16207", "#7c3aed", "#64748b"];

const axisCommon = {
  axisLine: { lineStyle: { color: "#94a3b8" } },
  axisLabel: { color: "#64748b", fontSize: 10 },
  splitLine: { lineStyle: { color: "#e2e8f0", opacity: 0.6 } },
};

/* eslint-disable @typescript-eslint/no-explicit-any */

type Hist = readonly { bucket: string; count: number; pct?: number }[];

export function lineBandOption(
  months: { month: string; mean: number | null; median: number | null; p25: number | null; p75: number | null }[]
): EChartsOption {
  const x = months.map((m) => m.month);
  const main = months.map((m) => (m.median ?? m.mean) ?? null);
  const bandLow = months.map((m) => m.p25);
  const bandHigh = months.map((m) => m.p75);
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 12, top: 20, bottom: 24 },
    xAxis: { type: "category", data: x, ...axisCommon, axisLabel: { color: "#64748b", fontSize: 10 } },
    yAxis: { type: "value", name: "jours", ...axisCommon },
    series: [
      { name: "P25", type: "line", data: bandLow as any, lineStyle: { opacity: 0 }, stack: "band", symbol: "none" as any },
      {
        name: "IQR",
        type: "line",
        data: bandHigh.map((v, i) => (v != null && bandLow[i] != null ? v - bandLow[i] : null)) as any,
        lineStyle: { opacity: 0 },
        areaStyle: { color: "#ea580c", opacity: 0.18 },
        stack: "band",
        symbol: "none" as any,
      },
      {
        name: "Médiane / moyenne (j)",
        type: "line",
        data: main as any,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { width: 3, color: "#ea580c" },
        itemStyle: { color: "#ea580c" },
      },
    ],
  } as unknown as EChartsOption;
}

export function donutOption(totals: { accorde: number; refuse: number; enAttente: number }): EChartsOption {
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "46%"],
        label: { formatter: "{b}\n{d}%", fontSize: 10, color: "#64748b" },
        data: [
          { name: "Accordé", value: totals.accorde, itemStyle: { color: PAL[2] } },
          { name: "Refusé", value: totals.refuse, itemStyle: { color: PAL[1] } },
          { name: "En attente", value: totals.enAttente, itemStyle: { color: PAL[5] } },
        ],
      },
    ],
  } as unknown as EChartsOption;
}

export function stacked100Option(byMonth: { month: string; accorde: number; refuse: number }[]): EChartsOption {
  const total = byMonth.map((d) => d.accorde + d.refuse);
  return {
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => `${v}%`, textStyle: { fontSize: 11 } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 40, right: 12, top: 20, bottom: 40 },
    xAxis: { type: "category", data: byMonth.map((d) => d.month), ...axisCommon },
    yAxis: { type: "value", max: 100, ...axisCommon, axisLabel: { formatter: "{value}%", fontSize: 10, color: "#64748b" } },
    series: [
      {
        name: "Accordé",
        type: "bar",
        stack: "t",
        barMaxWidth: 18,
        itemStyle: { color: PAL[2] },
        data: byMonth.map((d, i) => (total[i] ? Math.round((d.accorde / total[i]) * 100) : null)) as any,
      },
      {
        name: "Refusé",
        type: "bar",
        stack: "t",
        barMaxWidth: 18,
        itemStyle: { color: PAL[1] },
        data: byMonth.map((d, i) => (total[i] ? Math.round((d.refuse / total[i]) * 100) : null)) as any,
      },
    ],
  } as unknown as EChartsOption;
}

export function histogramOption(hist: Hist, color = PAL[0], yAxisLabel?: string): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 12, top: 20, bottom: 24 },
    xAxis: { type: "category", data: hist.map((h) => h.bucket), name: "jours", ...axisCommon },
    yAxis: { type: "value", name: yAxisLabel ?? "Réponses", ...axisCommon },
    series: [{ type: "bar", barMaxWidth: 26, itemStyle: { color }, data: hist.map((h) => h.count) }],
  } as unknown as EChartsOption;
}

export function calendarHeatmapOption(days: { date: string; count: number }[]): EChartsOption {
  const max = Math.max(2, ...days.map((d) => d.count));
  return {
    tooltip: {
      formatter: (p: unknown) => {
        const arr = (p as { data?: unknown[] }).data;
        if (Array.isArray(arr)) return `${arr[0]} : ${arr[1]}`;
        return "";
      },
      textStyle: { fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max,
      inRange: { color: ["#ffedd5", "#fdba74", "#ea580c", "#9a3412"] },
      show: false,
    },
    calendar: {
      range: [days[0]?.date ?? "2025-01-01", days[days.length - 1]?.date ?? "2025-12-31"],
      cellSize: [14, 13],
      itemStyle: { color: "rgba(148,163,184,0.08)", borderColor: "rgba(148,163,184,0.3)", borderWidth: 1 },
      yearLabel: { show: false },
      monthLabel: { color: "#64748b", fontSize: 10 },
      dayLabel: { show: false },
      orient: "horizontal",
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: days.map((d) => [d.date, d.count]),
      },
    ],
  } as unknown as EChartsOption;
}

export function funnelOption(steps: { label: string; count: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "item", textStyle: { fontSize: 11 } },
    series: [
      {
        type: "funnel",
        left: 10,
        right: 10,
        top: 8,
        bottom: 8,
        minSize: "22%",
        label: { formatter: "{b}: {c}", fontSize: 11 },
        data: steps.map((s) => ({ name: s.label, value: s.count })),
        color: PAL,
      },
    ],
  } as unknown as EChartsOption;
}

export function weeklyHeatmapOption(heatmap: { weekday: number; month: string; count: number }[]): EChartsOption {
  const months = [...new Set(heatmap.map((h) => h.month))].sort();
  const weekdays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const data = heatmap.map((h) => [months.indexOf(h.month), h.weekday, h.count]);
  return {
    tooltip: {
      formatter: (p: unknown) => {
        const arr = (p as { data?: unknown[] }).data;
        if (Array.isArray(arr)) {
          const xi = Number(arr[0]);
          const di = Number(arr[1]);
          return `Mois: ${months[xi] ?? "?"} · Jour: ${weekdays[Number.isNaN(di) ? 0 : di] ?? "?"} · n = ${Number(arr[2])}`;
        }
        return "";
      },
      textStyle: { fontSize: 11 },
    },
    grid: { left: 44, right: 12, top: 20, bottom: 48 },
    xAxis: { type: "category", data: months, ...axisCommon },
    yAxis: { type: "category", data: weekdays, ...axisCommon },
    visualMap: {
      min: 0,
      max: Math.max(2, ...heatmap.map((h) => h.count)),
      inRange: { color: ["#ffedd5", "#fdba74", "#ea580c", "#9a3412"] },
      calculable: false,
      orient: "horizontal",
      bottom: 0,
      left: "center",
      textStyle: { fontSize: 9 },
      itemHeight: 60,
    },
    series: [
      {
        type: "heatmap",
        data,
        label: { show: data.length > 0, fontSize: 9, color: "#374151" },
      },
    ],
  } as unknown as EChartsOption;
}

export function medianBoxOption(
  stats: { centerId?: number; center?: string; median: number; p25: number; p75: number; n: number }[]
): EChartsOption {
  const x = stats.map((s) => s.center ?? `Centre ${s.centerId}`);
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 40, right: 12, top: 24, bottom: 46 },
    xAxis: { type: "category", data: x, ...axisCommon, axisLabel: { interval: 0, fontSize: 9, color: "#64748b" } },
    yAxis: { type: "value", name: "jours", ...axisCommon },
    series: [
      {
        name: "P25-P75 (IQR)",
        type: "boxplot",
        itemStyle: { color: "#ffedd5", borderColor: "#ea580c" },
        data: stats.map((s) => [s.p25, s.p25, s.median, s.p75, s.p75]),
      },
      {
        name: "Médiane (j)",
        type: "line",
        symbol: "circle",
        symbolSize: 8,
        itemStyle: { color: "#9a3412" },
        data: stats.map((s) => s.median),
      },
      {
        name: "Nombre de réponses (n)",
        type: "bar",
        barMaxWidth: 14,
        itemStyle: { opacity: 0.25, color: PAL[0] },
        data: stats.map((s) => s.n),
      },
    ],
  } as unknown as EChartsOption;
}

export function approvalBarsOption(data: { centerId?: number; center?: string; approvedPct: number; n: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 12, top: 20, bottom: 46 },
    xAxis: {
      type: "category",
      data: data.map((d) => d.center ?? `Centre ${d.centerId}`),
      ...axisCommon,
      axisLabel: { interval: 0, fontSize: 9, color: "#64748b" },
    },
    yAxis: { type: "value", max: 100, ...axisCommon, axisLabel: { formatter: "{value}%", fontSize: 10, color: "#64748b" } },
    series: [
      {
        name: "Taux d'acceptation (%)",
        type: "bar",
        barMaxWidth: 26,
        itemStyle: { color: PAL[2] },
        data: data.map((d) => d.approvedPct),
      },
    ],
  } as unknown as EChartsOption;
}

export function survivalOption(steps: { t: number; s: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 12, top: 20, bottom: 26 },
    xAxis: { type: "category", name: "jours", data: steps.map((s) => s.t), ...axisCommon, axisLabel: { fontSize: 9, color: "#64748b", interval: 14 } },
    yAxis: { type: "value", max: 100, min: 0, ...axisCommon, axisLabel: { formatter: "{value}%", fontSize: 10, color: "#64748b" } },
    series: [
      {
        type: "line",
        step: "end",
        showSymbol: false,
        data: steps.map((s) => Math.round(s.s * 100)),
        lineStyle: { color: PAL[0], width: 2.5 },
        areaStyle: { color: PAL[0], opacity: 0.08 },
      },
    ],
  } as unknown as EChartsOption;
}

export function stackedBarOption(data: { bucket: string; accorde: number; refuse: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    legend: { bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 40, right: 12, top: 20, bottom: 40 },
    xAxis: { type: "category", data: data.map((d) => d.bucket), ...axisCommon },
    yAxis: { type: "value", name: "Réponses", ...axisCommon },
    series: [
      { name: "Accordé", type: "bar", stack: "o", barMaxWidth: 22, itemStyle: { color: PAL[2] }, data: data.map((d) => d.accorde) },
      { name: "Refusé", type: "bar", stack: "o", barMaxWidth: 22, itemStyle: { color: PAL[1] }, data: data.map((d) => d.refuse) },
    ],
  } as unknown as EChartsOption;
}

export function timelineOption(data: { date: string; count: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 36, right: 12, top: 16, bottom: 24 },
    xAxis: { type: "category", data: data.map((d) => d.date.slice(5)), ...axisCommon, axisLabel: { fontSize: 9, color: "#64748b", interval: 14 } },
    yAxis: { type: "value", name: "Réponses", ...axisCommon },
    series: [{ type: "bar", barMaxWidth: 8, itemStyle: { color: PAL[4] }, data: data.map((d) => d.count) }],
  } as unknown as EChartsOption;
}

export function lineSimpleOption(data: { intake: string; approvedPct: number; n: number }[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 12, top: 20, bottom: 26 },
    xAxis: { type: "category", data: data.map((d) => d.intake), ...axisCommon },
    yAxis: { type: "value", max: 100, ...axisCommon, axisLabel: { formatter: "{value}%", fontSize: 10, color: "#64748b" } },
    series: [
      {
        name: "Taux d'acceptation (%)",
        type: "line",
        symbolSize: 7,
        itemStyle: { color: PAL[0] },
        lineStyle: { color: PAL[0], width: 2.5 },
        data: data.map((d) => d.approvedPct),
      },
    ],
  } as unknown as EChartsOption;
}

export function horizBarOption(data: { reason: string; share: number; count: number }[]): EChartsOption {
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: unknown) => {
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
        const d = data[idx];
        return d ? `${d.share}% (n=${d.count})` : "";
      },
      textStyle: { fontSize: 11 },
    },
    grid: { left: 130, right: 30, top: 16, bottom: 24 },
    xAxis: { type: "value", max: 100, ...axisCommon, axisLabel: { formatter: "{value}%", fontSize: 10, color: "#64748b" } },
    yAxis: { type: "category", data: data.map((d) => d.reason), ...axisCommon, axisLabel: { fontSize: 10, color: "#64748b" } },
    series: [{ type: "bar", itemStyle: { color: PAL[1] }, barMaxWidth: 18, data: data.map((d) => d.share) }],
  } as unknown as EChartsOption;
}

export function gaugeOption(v: { days: number; median: number; p25: number; p75: number }): EChartsOption {
  const max = Math.max(v.days, v.p75, v.median) * 1.3 + 5;
  const color = v.days <= v.median ? PAL[2] : v.days <= v.p75 ? "#d97706" : PAL[1];
  return {
    series: [
      {
        type: "gauge",
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max,
        progress: { show: true, width: 14, itemStyle: { color } },
        axisLine: { lineStyle: { width: 14, color: "#64748b" } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: { fontSize: 22, offsetCenter: [0, "14%"], formatter: `${v.days} j` },
        data: [{ value: v.days, name: "" }],
      },
    ],
  } as unknown as EChartsOption;
}
