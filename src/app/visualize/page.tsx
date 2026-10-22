"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ChartCard, type Envelope } from "@/components/chartCard";
import { GlobalFilters, useDashboardFilters } from "@/components/filters";
import { t } from "@/lib/i18n";
import {
  countBarsOption,
  dailyLineOption,
  donutOption,
  histogramOption,
  lineBandOption,
  lineSimpleOption,
  stacked100Option,
  stackedBarOption,
  timelineOption,
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

  const useStat = (endKey: string) =>
    useQuery<Envelope<unknown>>({
      queryKey: [endKey, qs],
      queryFn: () => fetch(`/api/stats/${endKey}?${qs}`).then((r) => r.json()),
    });

  const pulse = useStat("pulse");
  const trend = useStat("wait-trend");
  const outcomes = useStat("outcomes");
  const histogram = useStat("wait-histogram");
  const timeline = useStat("response-timeline");
  const byWait = useStat("outcome-by-wait");
  const byIntake = useStat("approval-by-intake");
  const byLevel = useStat("approval-by-level");
  const docsSent = useStat("docs-sent-timeline");
  const lifecycle = useStat("lifecycle-timeline");

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
        <ChartCard title={t.dashboard.c3} stat={loaded(histogram)} render={(d) => histogramOption((d as { hist: never[] }).hist)} />
        <ChartCard
          title={t.dashboard.c12}
          stat={loaded(timeline)}
          render={(d) => timelineOption((d as { data: never[] }).data)}
          note="Nombre quotidien de réponses reçues sur les 90 derniers jours"
        />
        <ChartCard title={t.dashboard.c10} stat={loaded(byWait)} render={(d) => stackedBarOption((d as { data: never[] }).data)} />
        <ChartCard title={t.dashboard.c15} stat={loaded(byIntake)} render={(d) => lineSimpleOption((d as { intakes: never[] }).intakes)} />
        <ChartCard
          title={t.dashboard.c18}
          stat={loaded(byLevel)}
          render={(d) =>
            countBarsOption(
              ((d as { levels: { level: string; count: number }[] }).levels ?? []).map((l) => ({
                label: l.level === "master" ? "Master" : l.level === "licence" ? "Licence" : "Non précisé",
                count: l.count,
              })),
              "Visas accordés"
            )
          }
          note="Nombre de visas accordés selon le niveau d'études"
        />
        <ChartCard
          title={t.dashboard.c19}
          stat={loaded(docsSent)}
          render={(d) => dailyLineOption((d as { data: never[] }).data, "Dossiers envoyés")}
          note="Nombre de dossiers envoyés à l'ambassade par jour"
        />
      </div>
      <LifecycleTableStat stat={lifecycle.data} />
      <CohortDailyTableStat qs={qs} />
      <LifecycleDailyTableStat qs={qs} />
    </div>
  );
}

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

function LifecycleTableStat({ stat }: { stat?: Envelope<unknown> }) {
  if (!stat || stat.insufficientData || !stat.data) return null;
  const { months, series } = stat.data as {
    months: string[];
    series: { level: string; demande: number[]; envoi: number[]; reponse: number[] }[];
  };
  const master = series.find((s) => s.level === "master");
  const licence = series.find((s) => s.level === "licence");
  const cell = (arr: number[] | undefined, i: number) => arr?.[i] ?? 0;
  return (
    <div className="card mt-4 overflow-x-auto p-4">
      <h3 className="mb-1 text-sm font-bold">{t.dashboard.c20}</h3>
      <p className="mb-2 text-[11px] text-muted">Demande soumise, envoi du dossier à l&apos;ambassade et réponse reçue, par mois</p>
      <table className="w-full min-w-[640px] whitespace-nowrap text-xs sm:text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th rowSpan={2} className="py-1 align-bottom">
              Mois
            </th>
            <th colSpan={3} className="border-l border-[var(--border)] pl-3 text-center">
              Master
            </th>
            <th colSpan={3} className="border-l border-[var(--border)] pl-3 text-center">
              Licence
            </th>
          </tr>
          <tr className="text-left text-xs text-muted">
            <th className="border-l border-[var(--border)] pl-3">Demande</th>
            <th>Envoi ambassade</th>
            <th>Réponse</th>
            <th className="border-l border-[var(--border)] pl-3">Demande</th>
            <th>Envoi ambassade</th>
            <th>Réponse</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m} className="border-t border-[var(--border)] odd:bg-[var(--background)]">
              <td className="py-1.5 text-xs">
                {m.slice(5, 7)}/{m.slice(0, 4)}
              </td>
              <td className="border-l border-[var(--border)] pl-3">{cell(master?.demande, i)}</td>
              <td>{cell(master?.envoi, i)}</td>
              <td>{cell(master?.reponse, i)}</td>
              <td className="border-l border-[var(--border)] pl-3">{cell(licence?.demande, i)}</td>
              <td>{cell(licence?.envoi, i)}</td>
              <td>{cell(licence?.reponse, i)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LifecycleDailyTableStat({ qs }: { qs: string | null }) {
  const query = useQuery<Envelope<{ month: string; days: LifecycleDay[] }>>({
    queryKey: ["lifecycle-daily", qs],
    queryFn: () => fetch(`/api/stats/lifecycle-daily?${qs}`).then((r) => r.json()),
    enabled: qs !== null,
  });
  const stat = query.data;
  const cell = (c?: { demande: number; envoi: number; reponse: number }) => c ?? { demande: 0, envoi: 0, reponse: 0 };
  return (
    <div className="card mt-4 overflow-x-auto p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{t.dashboard.c20Daily}</h3>
      </div>
      <p className="mb-2 text-[11px] text-muted">Demande soumise, envoi du dossier à l&apos;ambassade et réponse reçue, jour par jour</p>
      {!stat ? (
        <p className="py-3 text-xs text-muted">Chargement…</p>
      ) : stat.insufficientData || !stat.data ? (
        <p className="py-3 text-xs text-muted">{t.dashboard.notEnoughHint(stat.n)}</p>
      ) : (
        <table className="w-full min-w-[640px] whitespace-nowrap text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th rowSpan={2} className="py-1 align-bottom">
                Jour
              </th>
              <th colSpan={3} className="border-l border-[var(--border)] pl-3 text-center">
                Master
              </th>
              <th colSpan={3} className="border-l border-[var(--border)] pl-3 text-center">
                Licence
              </th>
            </tr>
            <tr className="text-left text-xs text-muted">
              <th className="border-l border-[var(--border)] pl-3">Demande</th>
              <th>Envoi ambassade</th>
              <th>Réponse</th>
              <th className="border-l border-[var(--border)] pl-3">Demande</th>
              <th>Envoi ambassade</th>
              <th>Réponse</th>
            </tr>
          </thead>
          <tbody>
            {stat.data.days.map((d) => {
              const master = cell(d.master);
              const licence = cell(d.licence);
              return (
                <tr key={d.date} className="border-t border-[var(--border)] odd:bg-[var(--background)]">
                  <td className="py-1.5 text-xs">
                    {d.date.slice(8, 10)}/{d.date.slice(5, 7)}/{d.date.slice(0, 4)}
                  </td>
                  <td className="border-l border-[var(--border)] pl-3">{master.demande}</td>
                  <td>{master.envoi}</td>
                  <td>{master.reponse}</td>
                  <td className="border-l border-[var(--border)] pl-3">{licence.demande}</td>
                  <td>{licence.envoi}</td>
                  <td>{licence.reponse}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

type LifecycleDay = {
  date: string;
  master: { demande: number; envoi: number; reponse: number };
  licence: { demande: number; envoi: number; reponse: number };
};

function CohortDailyTableStat({ qs }: { qs: string | null }) {
  const query = useQuery<Envelope<{ month: string; days: CohortDay[] }>>({
    queryKey: ["cohort-daily", qs],
    queryFn: () => fetch(`/api/stats/cohort-daily?${qs}`).then((r) => r.json()),
    enabled: qs !== null,
  });
  const stat = query.data;
  return (
    <div className="card mt-4 overflow-x-auto p-4">
      <h3 className="mb-2 text-sm font-bold">{t.dashboard.c11}</h3>
      <p className="mb-2 text-[11px] text-muted">Suivi jour par jour des dossiers envoyés (cohorte du jour d′envoi)</p>
      {!stat ? (
        <p className="py-3 text-xs text-muted">Chargement…</p>
      ) : stat.insufficientData || !stat.data ? (
        <p className="py-3 text-xs text-muted">{t.dashboard.notEnoughHint(stat.n)}</p>
      ) : stat.data.days.length === 0 ? (
        <p className="py-3 text-xs text-muted">Aucun dossier envoyé ce mois-ci.</p>
      ) : (
        <table className="w-full min-w-[520px] whitespace-nowrap text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1">Jour d′envoi</th>
              <th>n</th>
              <th>Réponses reçues</th>
              <th>Accordés</th>
              <th>Attente médiane</th>
            </tr>
          </thead>
          <tbody>
            {stat.data.days.map((d) => (
              <tr key={d.date} className="border-t border-[var(--border)] odd:bg-[var(--background)]">
                <td className="py-1.5 text-xs">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}/{d.date.slice(0, 4)}</td>
                <td>{d.n}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded bg-[var(--border)]">
                      <div className="h-full bg-[var(--primary)]" style={{ width: `${d.answeredPct}%` }} />
                    </div>
                    <span>{d.answeredPct}%</span>
                  </div>
                </td>
                <td>{d.approvedPct}%</td>
                <td>{d.medianWait == null ? "—" : `${d.medianWait} j`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type CohortDay = { date: string; n: number; answeredPct: number; approvedPct: number; medianWait: number | null };
