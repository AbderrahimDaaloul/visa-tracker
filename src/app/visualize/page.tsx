"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ChartCard, type Envelope } from "@/components/chartCard";
import { GlobalFilters, useDashboardFilters } from "@/components/filters";
import { t } from "@/lib/i18n";
import {
  approvalBarsOption,
  calendarHeatmapOption,
  donutOption,
  funnelOption,
  histogramOption,
  horizBarOption,
  lineBandOption,
  lineSimpleOption,
  medianBoxOption,
  stacked100Option,
  stackedBarOption,
  survivalOption,
  timelineOption,
  weeklyHeatmapOption,
} from "@/lib/charts";

type TrendMonths = { months: { month: string; mean: number | null; median: number | null; p25: number | null; p75: number | null }[] };

export default function CommunityDashboard() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardBody />
    </Suspense>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-52 animate-pulse" />
      ))}
    </div>
  );
}

function DashboardBody() {
  const qs = useDashboardFilters();
  const { data: centersQ } = useQuery<{ centers: { id: number; name: string }[] }>({
    queryKey: ["centers"],
    queryFn: () => fetch("/api/centers").then((r) => r.json()),
  });
  const centerName = (id: number): string => centersQ?.centers?.find((c) => c.id === id)?.name ?? `Centre ${id}`;

  const useStat = (endKey: string, extra?: string) =>
    useQuery<Envelope<unknown>>({
      queryKey: [endKey, qs, extra],
      queryFn: () => fetch(`/api/stats/${endKey}?${[qs, extra].filter(Boolean).join("&")}`).then((r) => r.json()),
    });

  const pulse = useStat("pulse");
  const trend = useStat("wait-trend");
  const outcomes = useStat("outcomes");
  const histogram = useStat("wait-histogram");
  const calendar = useStat("appointment-calendar");
  const calendarBooking = useStat("appointment-calendar", "mode=reservation");
  const funnel = useStat("funnel");
  const slotRelease = useStat("slot-release");
  const byCenter = useStat("by-center");
  const survival = useStat("survival");
  const byWait = useStat("outcome-by-wait");
  const cohortTable = useStat("cohort-table");
  const timeline = useStat("response-timeline");
  const apptResponse = useStat("appointment-to-response");
  const rejection = useStat("rejection-reasons");
  const byIntake = useStat("approval-by-intake");
  const leadTime = useStat("lead-time");

  const loaded = (q: { data?: Envelope<unknown> }): Envelope<unknown> | undefined => q.data;

  return (
    <div className="space-y-1">
      <h1 className="mb-3 text-xl font-extrabold">{t.dashboard.title}</h1>
      <GlobalFilters />
      {pulse.data && !pulse.data.insufficientData ? <PulseCards data={pulse.data.data as never} /> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title={t.dashboard.c1} stat={loaded(trend)} render={(d) => lineBandOption((d as TrendMonths).months ?? [])} />
        <ChartCard title={t.dashboard.c2} stat={loaded(outcomes)} render={(d) => donutOption((d as { totals: never }).totals)} note="Répartition sur la période filtrée" />
        <ChartCard title={t.dashboard.c2 + " — par mois"} stat={loaded(outcomes)} render={(d) => stacked100Option((d as { byMonth: never[] }).byMonth)} />
        <ChartCard
          title={t.dashboard.c9}
          stat={loaded(survival)}
          render={(d) => survivalOption((d as { steps: never[] }).steps)}
          note="% des dossiers encore sans réponse après N jours (dossiers en attente comptés)"
        />
        <ChartCard title={t.dashboard.c4Rendezvous} stat={loaded(calendar)} render={(d) => calendarHeatmapOption((d as { days: never[] }).days ?? [])} />
        <ChartCard title={t.dashboard.c4Reservation} stat={loaded(calendarBooking)} render={(d) => calendarHeatmapOption((d as { days: never[] }).days ?? [])} />
        <ChartCard title={t.dashboard.c3} stat={loaded(histogram)} render={(d) => histogramOption((d as { hist: never[] }).hist)} />
        <ChartCard title={t.dashboard.c12} stat={loaded(timeline)} render={(d) => timelineOption((d as { data: never[] }).data)} />
        <ChartCard
          title={t.dashboard.c13}
          stat={loaded(apptResponse)}
          render={(d) => histogramOption((d as { hist: never[] }).hist)}
          note="Du rendez-vous à la réponse"
        />
        <ChartCard
          title={t.dashboard.c7}
          stat={loaded(byCenter)}
          render={(d) =>
            medianBoxOption(
              ((d as { waitByCenter: { centerId: number; median: number; p25: number; p75: number; n: number }[] }).waitByCenter ?? []).map((s) => ({
                ...s,
                center: centerName(s.centerId),
              }))
            )
          }
        />
        <ChartCard
          title={t.dashboard.c8}
          stat={loaded(byCenter)}
          render={(d) =>
            approvalBarsOption(
              ((d as { approvalByCenter: { centerId: number; approvedPct: number; n: number }[] }).approvalByCenter ?? []).map((s) => ({
                ...s,
                center: centerName(s.centerId),
              }))
            )
          }
        />
        <ChartCard title={t.dashboard.c5} stat={loaded(funnel)} render={(d) => funnelOption((d as { steps: never[] }).steps)} />
        <ChartCard
          title={t.dashboard.c6}
          stat={loaded(slotRelease)}
          render={(d) => weeklyHeatmapOption((d as { heatmap: never[] }).heatmap)}
          note="Lundi en haut → Dimanche ; basé sur la date à laquelle les créneaux ont été trouvés"
        />
        <ChartCard title={t.dashboard.c10} stat={loaded(byWait)} render={(d) => stackedBarOption((d as { data: never[] }).data)} />
        <ChartCard
          title={t.dashboard.c14}
          stat={loaded(rejection)}
          render={(d) =>
            horizBarOption(
              ((d as { reasons: { reason: string; share: number; count: number }[] }).reasons ?? []).map((r) => ({
                ...r,
                reason: REASON_LABELS[r.reason] ?? r.reason,
              }))
            )
          }
          note="Visible à partir de n ≥ 10 refus"
        />
        <ChartCard
          title={t.dashboard.c17}
          stat={loaded(leadTime)}
          render={(d) => histogramOption((d as { hist: never[] }).hist)}
          note="Délai entre réservation du créneau et rendez-vous"
        />
        <ChartCard title={t.dashboard.c15} stat={loaded(byIntake)} render={(d) => lineSimpleOption((d as { intakes: never[] }).intakes)} />
      </div>
      <CohortTableStat stat={cohortTable.data} />
    </div>
  );
}

const REASON_LABELS: Record<string, string> = {
  documents_manquants: "Documents manquants",
  preuve_financiere: "Preuves financières",
  admission: "Admission",
  non_precise: "Non précisé",
};

function PulseCards({
  data,
}: {
  data: { activeContributors: number; newDataThisWeek: number; currentMedianWait: number | null; currentApprovalRate: number | null; pendingCases: number };
}) {
  const tiles: { label: string; value: string }[] = [
    { label: "Contributeurs actifs (30 j)", value: String(data.activeContributors ?? 0) },
    { label: "Nouvelles données (7 j)", value: String(data.newDataThisWeek ?? 0) },
    { label: "Attente médiane (j)", value: data.currentMedianWait == null ? "—" : String(data.currentMedianWait) },
    { label: "Taux d'acceptation (90 j)", value: data.currentApprovalRate == null ? "—" : `${data.currentApprovalRate}%` },
    { label: "Dossiers en attente", value: String(data.pendingCases ?? 0) },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((x) => (
        <div key={x.label} className="card p-3">
          <p className="text-2xl font-extrabold text-[var(--primary)]">{x.value}</p>
          <p className="text-[11px] text-muted">{x.label}</p>
        </div>
      ))}
    </div>
  );
}

function CohortTableStat({ stat }: { stat?: Envelope<unknown> }) {
  if (!stat || stat.insufficientData || !stat.data) return null;
  const weeks = (stat.data as { weeks: { week: string; n: number; answeredPct: number; approvedPct: number; medianWait: number | null }[] }).weeks.slice(-16);
  return (
    <div className="card mt-4 overflow-x-auto p-4">
      <h3 className="mb-2 text-sm font-bold">{t.dashboard.c11}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1">Semaine d′envoi</th>
            <th>n</th>
            <th>Réponses reçues</th>
            <th>Accordés</th>
            <th>Attente médiane</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.week} className="border-t border-[var(--border)]">
              <td className="py-1.5 font-mono text-xs">{w.week}</td>
              <td>{w.n}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded bg-[var(--border)]">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${w.answeredPct}%` }} />
                  </div>
                  <span>{w.answeredPct}%</span>
                </div>
              </td>
              <td>{w.approvedPct}%</td>
              <td>{w.medianWait == null ? "—" : `${w.medianWait} j`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
