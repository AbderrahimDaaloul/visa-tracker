"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Skeleton, cn } from "@/components/ui";
import { t } from "@/lib/i18n";
import { dateFmt } from "@/lib/formatNum";
import { gaugeOption } from "@/lib/charts";
import { EChartBox } from "@/components/echartBox";

type MyApp = {
  id: string;
  centerId: number;
  visaType: string;
  intake: string;
  appointmentDate: string | null;
  appointmentSlot: string | null;
  slotBookedOn: string | null;
  docsSentDate: string | null;
  outcome: string;
  responseDate: string | null;
  stage: "inscrit" | "soumis" | "rendezvous" | "reponse";
  currentWait: { days: number; basis: string } | null;
  appointmentCountdownDays: number | null;
};

type Bench = {
  myWaitDays: number | null;
  pending: boolean;
  n: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  p90: number | null;
  longerPct: number | null;
  insufficient: boolean;
};

const STAGES: { key: MyApp["stage"]; label: string }[] = [
  { key: "inscrit", label: t.journey.stage.inscrit },
  { key: "soumis", label: t.journey.stage.soumis },
  { key: "rendezvous", label: t.journey.stage.rendezvous },
  { key: "reponse", label: t.journey.stage.reponse },
];

export default function JourneyPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setReady(true);
        if (!d.user) router.replace("/login");
      });
  }, [router]);

  const { data: appsQ, isLoading } = useQuery<{ applications: MyApp[] }>({
    queryKey: ["myApps"],
    queryFn: () => fetch("/api/me/applications").then((r) => r.json()),
    enabled: ready,
  });

  if (!ready || isLoading) return <Skeleton className="h-64 w-full" />;
  const apps = appsQ?.applications ?? [];
  if (apps.length === 0) {
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <h1 className="text-xl font-extrabold">{t.journey.title}</h1>
        <p className="mt-4 text-muted">{t.journey.noApp}</p>
        <Button className="mt-4" onClick={() => router.push("/contribute")}>
          {t.nav.contribute}
        </Button>
      </div>
    );
  }
  const app = apps[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">{t.journey.title}</h1>
        <div className="flex gap-2 overflow-x-auto">
          {apps.slice(0, 4).map((a, i) => (
            <Badge key={a.id} color={i === 0 ? "primary" : "muted"}>
              {a.intake}
            </Badge>
          ))}
        </div>
      </div>
      <StepTracker app={app} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AmILate app={app} />
        <Countdown app={app} />
        <WindowCard app={app} />
        <PositionCard app={app} />
        <CohortSnapshot app={app} />
        <SummaryCard app={app} />
      </div>
    </div>
  );
}

function StepTracker({ app }: { app: MyApp }) {
  const activeIdx = STAGES.findIndex((s) => s.key === app.stage);
  return (
    <Card>
      <h2 className="mb-4 text-sm font-bold">{t.journey.stepTracker}</h2>
      <ol className="flex items-center gap-1">
        {STAGES.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center">
            <div className={cn("flex items-center gap-2 rounded-lg px-2 py-1", i === activeIdx && cn("bg-[var(--background)] font-bold", "text-[var(--primary)]"))}>
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold",
                  i < activeIdx
                    ? "border-[var(--success)] bg-[var(--success)] text-white"
                    : i === activeIdx
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-[var(--border)] text-muted"
                )}
              >
                {i < activeIdx ? "✓" : i + 1}
              </span>
              <span className="hidden text-xs sm:inline">{s.label}</span>
            </div>
            {i < STAGES.length - 1 ? <div className={cn("h-0.5 flex-1", i < activeIdx ? "bg-[var(--success)]" : "bg-[var(--border)]")} /> : null}
          </li>
        ))}
      </ol>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
        <span>Dossier : {dateFmt(app.docsSentDate)}</span>
        <span>RDV : {dateFmt(app.appointmentDate)}</span>
        <span>Réponse : {dateFmt(app.responseDate)}</span>
      </div>
    </Card>
  );
}

function AmILate({ app }: { app: MyApp }) {
  const { data: bench, isLoading } = useQuery<Bench>({
    queryKey: ["benchmark", app.id],
    queryFn: () => fetch(`/api/me/benchmark?applicationId=${app.id}`).then((r) => r.json()),
  });
  if (isLoading || bench === undefined) return <Skeleton className="h-52 w-full" />;
  if (bench.insufficient || bench.myWaitDays == null || bench.median == null) {
    return (
      <Card>
        <h2 className="text-sm font-bold">{t.journey.amILate}</h2>
        <p className="mt-3 text-sm text-muted">{t.dashboard.notEnoughHint(bench.n ?? 0)}</p>
      </Card>
    );
  }
  const zone = bench.myWaitDays <= bench.median ? "success" : bench.myWaitDays <= (bench.p75 ?? Infinity) ? "warn" : "error";
  const zoneLabel = zone === "success" ? t.journey.gauge.mid : zone === "warn" ? t.journey.gauge.mid : t.journey.gauge.late;
  return (
    <Card>
      <h2 className="text-sm font-bold">{t.journey.amILate}</h2>
      <div className="mt-1 h-44">
        <EChartBox option={gaugeOption({ days: bench.myWaitDays, median: bench.median, p25: bench.p25 ?? 0, p75: bench.p75 ?? bench.median })} />
      </div>
      <div className="mt-2 space-y-1 text-sm">
        <p>{t.journey.gauge.you(bench.myWaitDays)}</p>
        <p className="text-muted">{t.journey.gauge.median(bench.median)}</p>
        {bench.longerPct != null ? <p className="text-xs text-muted">{t.journey.gauge.longer(bench.longerPct)}</p> : null}
        <p className={cn("font-semibold", zone === "error" ? "text-[var(--danger)]" : zone === "success" ? "text-[var(--success)]" : "text-[#d97706]")}>{zoneLabel}</p>
        <p className="text-[10px] text-muted">
          n = {bench.n} · estimation communautaire, pas une promesse
        </p>
      </div>
    </Card>
  );
}

function Countdown({ app }: { app: MyApp }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!app.appointmentDate) return null;
  const appt = Date.parse(`${app.appointmentDate}T09:00:00`);
  const diffMs = appt - now;
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return (
    <Card>
      <h2 className="text-sm font-bold">{past ? `${t.journey.daysSince} rendez-vous` : t.journey.countdown}</h2>
      <p className="mt-4 text-center font-mono text-3xl font-extrabold tracking-tight text-[var(--primary)]">
        {d}j {h}h {m}min {s}s
      </p>
      <p className="mt-2 text-center text-xs text-muted">Rendez-vous : {dateFmt(app.appointmentDate)}</p>
    </Card>
  );
}

function WindowCard({ app }: { app: MyApp }) {
  const { data: bench } = useQuery<Bench>({
    queryKey: ["benchmark", app.id],
    queryFn: () => fetch(`/api/me/benchmark?applicationId=${app.id}`).then((r) => r.json()),
  });
  const base = app.docsSentDate ?? app.appointmentDate;
  if (!base) return null;
  if (!bench || bench.insufficient || bench.p25 == null || bench.p90 == null) {
    return (
      <Card>
        <h2 className="text-sm font-bold">{t.journey.window}</h2>
        <p className="mt-3 text-sm text-muted">{t.dashboard.notEnoughHint(bench?.n ?? 0)}</p>
      </Card>
    );
  }
  const add = (days: number) => dateFmt(new Date(Date.parse(`${base}T00:00:00Z`) + days * 86400000));
  return (
    <Card>
      <h2 className="text-sm font-bold">{t.journey.window}</h2>
      <div className="relative mt-6 h-10">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-[var(--border)]" />
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--primary)]"
          style={{ left: `${Math.min(100, (bench.p25 / Math.max(1, bench.p90)) * 100)}%`, width: `${Math.min(100, ((bench.p90 - bench.p25) / Math.max(1, bench.p90)) * 100)}%`, opacity: 0.25 }}
        />
        <div
          className="absolute top-1.5 h-7 w-0 border-2 border-dashed border-[var(--primary)]"
          style={{ left: `${Math.min(100, ((bench.median ?? bench.p25) / Math.max(1, bench.p90)) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>
          P25 {add(bench.p25)} · M {add(bench.median ?? bench.p25)} · P90 {add(bench.p90)}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted">Fenêtre estimée depuis le {dateFmt(base)} · n = {bench.n}</p>
    </Card>
  );
}

function PositionCard({ app }: { app: MyApp }) {
  const pdf = useQuery<EnvelopeHist>({
    queryKey: ["hist", "all"],
    queryFn: () => fetch("/api/stats/wait-histogram").then((r) => r.json()),
  });
  const { data: bench } = useQuery<Bench>({ queryKey: ["benchmark", app.id], queryFn: () => fetch(`/api/me/benchmark?applicationId=${app.id}`).then((r) => r.json()) });
  if (pdf.isLoading || !bench) return null;
  if (pdf.data?.insufficientData || bench.myWaitDays == null) {
    return (
      <Card>
        <h2 className="text-sm font-bold">{t.journey.myPosition}</h2>
        <p className="mt-3 text-sm text-muted">{t.dashboard.notEnoughHint(pdf.data?.n ?? 0)}</p>
      </Card>
    );
  }
  const hist = pdf.data!.data.hist;
  const idx = hist.findIndex((b) => bench.myWaitDays! <= Number(String(b.bucket.split("-")[1] === "+" ? Infinity : b.bucket.split("-")[1])));
  const option = histogramBinOption(hist, idx === -1 ? hist.length - 1 : idx);
  return (
    <Card>
      <h2 className="text-sm font-bold">{t.journey.myPosition}</h2>
      <div className="h-40">
        <EChartBox option={option} />
      </div>
      {bench.longerPct != null ? (
        <p className="text-xs text-muted">{t.journey.gauge.longer(bench.longerPct)}</p>
      ) : null}
    </Card>
  );
}

type EnvelopeHist = { n: number; insufficientData: boolean; data: { hist: { bucket: string; count: number }[] } };

function histogramBinOption(hist: { bucket: string; count: number }[], myIdx: number) {
  const data = hist.map((h, i) => ({ value: h.count, itemStyle: { color: i === myIdx ? "#ea580c" : "#2563eb" } }));
  return {
    tooltip: {},
    grid: { left: 36, right: 10, top: 16, bottom: 22 },
    xAxis: { type: "category" as const, data: hist.map((h) => h.bucket) },
    yAxis: { type: "value" as const },
    series: [{ type: "bar" as const, data, barMaxWidth: 24 }],
  };
}

function CohortSnapshot({ app }: { app: MyApp }) {
  const router = useRouter();
  const exact = useQuery<{ n: number; insufficientData: boolean; data: { funnel: Record<string, number>; medianSinceAppointment: number | null } | null }>({
    queryKey: ["cohort", app.id],
    queryFn: () => fetch(`/api/cohorts/same-appointment?applicationId=${app.id}&window=exact`).then((r) => r.json()),
  });
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{t.journey.cohort}</h2>
      </div>
      {exact.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : exact.data?.insufficientData || !exact.data?.data ? (
        <p className="mt-3 text-sm text-muted">{t.dashboard.notEnoughHint(exact.data?.n ?? 0)}</p>
      ) : (
        <div className="mt-2 flex gap-2 text-center text-xs">
          {[
            ["RDV", exact.data.n],
            ["Dossiers", exact.data.data.funnel.dossiers_envoyes],
            ["Réponses", exact.data.data.funnel.reponses_recues],
            ["Accordés", exact.data.data.funnel.accorde],
            ["Refusés", exact.data.data.funnel.refuse],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex-1 rounded-lg border border-[var(--border)] p-2">
              <p className="text-base font-bold">{String(value)}</p>
              <p className="text-muted">{String(label)}</p>
            </div>
          ))}
        </div>
      )}
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => router.push(`/cohorts?applicationId=${app.id}`)}>
        Voir en détail
      </Button>
    </Card>
  );
}

function SummaryCard({ app }: { app: MyApp }) {
  const router = useRouter();
  return (
    <Card>
      <h2 className="text-sm font-bold">{t.journey.summary}</h2>
      <dl className="mt-3 space-y-1 text-sm">
        <Row k="Dossier envoyé" v={dateFmt(app.docsSentDate)} />
        <Row k="Rendez-vous" v={dateFmt(app.appointmentDate)} />
        <Row k="Réponse" v={dateFmt(app.responseDate)} />
        <Row k="Résultat" v={app.outcome === "accorde" ? "Accordé 🎉" : app.outcome === "refuse" ? "Refusé" : "En attente"} />
      </dl>
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => router.push("/contribute")}>
        Modifier / compléter
      </Button>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] pb-1">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
