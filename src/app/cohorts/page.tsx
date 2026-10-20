"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge, Card, Label, Select, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

export default function CohortsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <CohortsBody />
    </Suspense>
  );
}

function CohortsBody() {
  const router = useRouter();
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setReady(true);
        if (!d.user) router.replace("/login");
      });
  }, [router]);
  const { data: appsQ } = useQuery<{ applications: { id: string; centerId: number; intake: string; appointmentDate: string | null; docsSentDate: string | null }[] }>({
    queryKey: ["myApps"],
    queryFn: () => fetch("/api/me/applications").then((r) => r.json()),
    enabled: ready,
  });
  const apps = appsQ?.applications ?? [];
  const [appId, setAppId] = useState<string | null>(sp.get("applicationId") ?? (apps[0]?.id ?? null));
  const [window_, setWindow_] = useState(sp.get("window") ?? "exact");
  const [mode, setMode] = useState<"appointment" | "submission">("appointment");

  const cohort = useQuery<Record<string, unknown>>({
    queryKey: ["cohortPage", appId, mode, window_],
    queryFn: () => fetch(`/api/cohorts/same-${mode === "appointment" ? "appointment" : "submission"}?applicationId=${appId}&window=${window_}`).then((r) => r.json()),
    enabled: ready && !!appId,
  });
  const data = (cohort.data ?? {}) as {
    n?: number;
    insufficientData?: boolean;
    window?: string;
    data?: Record<string, unknown>;
    expanded?: boolean;
  };

  if (!ready) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-extrabold">{t.nav.cohorts}</h1>
      {apps.length === 0 ? (
        <p className="text-muted">{t.journey.noApp}</p>
      ) : (
        <>
          <Card className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label>Candidature</Label>
              <Select
                value={appId ?? ""}
                onChange={(e) => {
                  setAppId(e.target.value || null);
                  router.replace(`/cohorts?applicationId=${e.target.value}&window=${window_}`);
                }}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.appointmentDate ? `RDV ${a.appointmentDate}` : a.docsSentDate ? `Envoyé ${a.docsSentDate}` : a.intake} — {a.intake}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={mode} onChange={(e) => setMode(e.target.value as "appointment" | "submission")}>
                <option value="appointment">Même rendez-vous</option>
                <option value="submission">Même envoi</option>
              </Select>
            </div>
            <div>
              <Label>Fenêtre</Label>
              <Select value={window_} onChange={(e) => setWindow_(e.target.value)}>
                <option value="exact">La même date</option>
                <option value="trois_jours">±3 jours</option>
                <option value="semaine">La même semaine</option>
                <option value="mois">Le même mois</option>
              </Select>
            </div>
            <div className="self-end text-xs text-muted">
              {(data.n ?? 0) > 0 ? `n = ${data.n}${data.expanded ? " (élargie à ±3 j)" : ""}` : ""}
            </div>
          </Card>

          {cohort.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data.insufficientData || !data.data ? (
            <Card>
              <p className="text-sm font-semibold">{t.dashboard.notEnough}</p>
              <p className="mt-1 text-xs text-muted">
                {t.dashboard.notEnoughHint(data.n ?? 0)} — {` « Les étudiants avec des rendez-vous à ±3 jours du votre » `} sera utilisée automatiquement quand possible.
              </p>
            </Card>
          ) : mode === "appointment" ? (
            <Card>
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-bold">
                  Cohorte : {data.window} <Badge color="primary">n = {data.n}</Badge>
                </h2>
              </div>
              <div className="mt-3 space-y-2">
                {(Object.entries(APPOINTMENT_STEPS) as [string, string][])
                  .filter(([k]) => (data.data!.funnel as Record<string, number>)[k] !== undefined)
                  .map(([k, label]) => {
                    const value = (data.data!.funnel as Record<string, number>)[k];
                    const pct = Math.round((value / Math.max(1, data.n!)) * 100);
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs">
                          <span>{label}</span>
                          <span className="text-muted">
                            {value} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded bg-[var(--border)]">
                          <div className="h-2 rounded bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
              <p className="mt-2 text-xs text-muted">
                {"Jours écoulés depuis RDV : médiane "}
                {typeof data.data.medianSinceAppointment === "number" ? `${data.data.medianSinceAppointment} J` : "—"}
              </p>
              <div className="mt-4">
                <h3 className="text-xs font-bold">Détail (hors pseudos tenus privés)</h3>
                <ul className="mt-1 max-h-60 space-y-1 overflow-auto text-xs">
                  {((data.data.rows ?? []) as { pseudo: string; status: string; daysSinceAppointment: number }[]).map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1">
                      <span>@{r.pseudo}</span>
                      <span className="text-muted">
                        {r.status} · {r.daysSinceAppointment} j
                      </span>
                    </li>
                  ))}
                  {Number(((data.data as unknown as { hiddenRows?: number }).hiddenRows ?? 0)) > 0 ? (
                    <li className="text-muted">… +{((data.data as unknown as { hiddenRows?: number }).hiddenRows ?? 0)} étudiants anonymes</li>
                  ) : null}
                </ul>
              </div>
            </Card>
          ) : (
            <Card>
              <h2 className="text-sm font-bold">
                Cohorte envoi : {data.window} <Badge color="primary">n = {data.n}</Badge>
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Metric label="Réponses" value={`${(data.data as Record<string, unknown>).answeredPct}%`} />
                <Metric label="Accordés" value={`${(data.data as Record<string, unknown>).approvedPct}%`} />
                <Metric label="Attente médiane" value={`${(data.data as Record<string, unknown>).medianWaitSoFar ?? "—"} j`} />
              </div>
              <MiniTimeline timeline={((data.data as Record<string, unknown>).timeline ?? []) as { days: number; count: number }[]} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const APPOINTMENT_STEPS: Record<string, string> = {
  rendez_vous_passes: "RDV passés",
  dossiers_envoyes: "Dossiers envoyés",
  responses_recues: "Réponses reçues",
  accorde: "Accordés",
  refuse: "Refusés",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-2">
      <p className="text-base font-bold">{value}</p>
      <p className="text-muted">{label}</p>
    </div>
  );
}

function MiniTimeline({ timeline }: { timeline: { days: number; count: number }[] }) {
  if (timeline.length === 0) return null;
  const max = Math.max(...timeline.map((x) => x.count));
  return (
    <div className="mt-4">
      <h3 className="text-xs font-bold">Réponses reçues par jour après l′envoi</h3>
      <div className="mt-2 flex h-16 items-end gap-0.5">
        {timeline.map((x) => (
          <div key={x.days} className="flex-1 rounded-t bg-[var(--primary)] opacity-70" style={{ height: `${Math.round((x.count / max) * 100)}%`, minWidth: 3 }} title={`J+${x.days} : ${x.count}`} />
        ))}
      </div>
      <p className="text-[10px] text-muted">J+{timeline[0].days} → J+{timeline[timeline.length - 1].days}</p>
    </div>
  );
}
