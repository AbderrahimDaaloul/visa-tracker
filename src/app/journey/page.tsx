"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Skeleton, cn } from "@/components/ui";
import { t } from "@/lib/i18n";
import { dateFmt } from "@/lib/formatNum";
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
  stage: "inscrit" | "soumis" | "reponse";
  createdAt: string;
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

const STAGES: { key: MyApp["stage"]; label: string; date: (app: MyApp) => string | null }[] = [
  { key: "inscrit", label: t.journey.stage.inscrit, date: (app) => app.createdAt },
  { key: "soumis", label: t.journey.stage.soumis, date: (app) => app.docsSentDate },
  { key: "reponse", label: t.journey.stage.reponse, date: (app) => app.responseDate },
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
        <PositionCard app={app} />
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
      <ol className="relative flex items-stretch gap-1">
        {STAGES.map((s, i) => (
          <li key={s.key} className="relative flex flex-1 flex-col items-center">
            {i < STAGES.length - 1 ? (
              <div
                className={cn(
                  "absolute left-1/2 top-4 h-0.5 w-full",
                  i < activeIdx ? "bg-[var(--success)]" : "bg-[var(--border)]"
                )}
              />
            ) : null}
            <div className={cn("relative flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-center", i === activeIdx && cn("bg-[var(--background)] font-bold", "text-[var(--primary)]"))}>
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--surface)] text-xs font-bold",
                  i < activeIdx
                    ? "border-[var(--success)] bg-[var(--success)] text-white"
                    : i === activeIdx
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-[var(--border)] text-muted"
                )}
              >
                {i < activeIdx ? "✓" : i + 1}
              </span>
              <span className="hidden flex-col text-xs sm:flex">
                <span>{s.label}</span>
                <span className="text-[10px] font-normal text-muted">{dateFmt(s.date(app))}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
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
  const zoneLabel = zone === "success" ? t.journey.gauge.early : zone === "warn" ? t.journey.gauge.mid : t.journey.gauge.late;
  const zoneTone = zone === "error" ? "danger" : zone === "success" ? "success" : "primary";
  const scale = Math.max(1, bench.p75 ?? bench.median, bench.myWaitDays);
  const pct = (v: number) => Math.min(100, Math.max(0, (v / scale) * 100));
  const faster = bench.longerPct != null && bench.longerPct >= 50;
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold">{t.journey.amILate}</h2>
        <Badge color={zoneTone}>{zoneLabel}</Badge>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-extrabold tracking-tight text-[var(--primary)]">
          {t.journey.gauge.daysUnit(bench.myWaitDays)}
        </span>
        <span className="text-xs text-muted">{t.journey.gauge.waitingSince}</span>
      </div>

      <div className="mt-5">
        <div className="relative h-2.5 rounded-full bg-[var(--border)]">
          <div
            className="absolute inset-y-0 rounded-full bg-[var(--success)]/25"
            style={{ width: `${pct(bench.median)}%` }}
          />
          <div
            className="absolute -top-1 h-4.5 w-0.5 rounded bg-[var(--success)]"
            style={{ left: `${pct(bench.median)}%` }}
            title={t.journey.gauge.medianLabel}
          />
          <div
            className={cn(
              "absolute -top-1 h-4.5 w-1 rounded",
              zone === "error" ? "bg-[var(--danger)]" : zone === "success" ? "bg-[var(--success)]" : "bg-[#d97706]"
            )}
            style={{ left: `${pct(bench.myWaitDays)}%` }}
            title={t.journey.gauge.youMarker}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{t.journey.gauge.youMarker}</span>
          <span>
            {t.journey.gauge.medianLabel} · {t.journey.gauge.daysUnit(bench.median)}
          </span>
        </div>
      </div>

      {bench.longerPct != null ? (
        <p className="mt-4 text-sm">
          {faster
            ? t.journey.gauge.faster(bench.longerPct)
            : t.journey.gauge.slower(100 - bench.longerPct)}
        </p>
      ) : null}

      <p className="mt-auto border-t border-[var(--border)] pt-2 text-[10px] text-muted">
        {t.journey.gauge.note(bench.n)}
      </p>
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
    <Card className="flex flex-col">
      <h2 className="text-sm font-bold">{past ? `${t.journey.daysSince} rendez-vous` : t.journey.countdown}</h2>
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <p className="font-mono text-3xl font-extrabold tracking-tight text-[var(--primary)]">
          {d}j {h}h {m}min {s}s
        </p>
        <p className="mt-2 text-xs text-muted">Rendez-vous : {dateFmt(app.appointmentDate)}</p>
      </div>
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
      <Card className="flex flex-col">
        <h2 className="text-sm font-bold">{t.journey.myPosition}</h2>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">{t.dashboard.notEnoughHint(pdf.data?.n ?? 0)}</p>
        </div>
      </Card>
    );
  }
  const hist = pdf.data!.data.hist;
  const idx = hist.findIndex((b) => {
    const upper = b.bucket.endsWith("+") ? Infinity : Number(b.bucket.split("-")[1]);
    return bench.myWaitDays! <= upper;
  });
  const option = histogramBinOption(hist, idx === -1 ? hist.length - 1 : idx);
  return (
    <Card className="flex flex-col">
      <h2 className="text-sm font-bold">{t.journey.myPosition}</h2>
      <div className="min-h-40 flex-1">
        <EChartBox option={option} />
      </div>
      {bench.longerPct != null ? (
        <p className="mt-2 text-xs text-muted">{t.journey.gauge.longer(bench.longerPct)}</p>
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

function SummaryCard({ app }: { app: MyApp }) {
  const router = useRouter();
  return (
    <Card className="flex flex-col">
      <h2 className="text-sm font-bold">{t.journey.summary}</h2>
      <dl className="mt-3 flex-1 space-y-1 text-sm">
        <Row k="Dossier envoyé" v={dateFmt(app.docsSentDate)} />
        <Row k="Rendez-vous" v={dateFmt(app.appointmentDate)} />
        <Row k="Réponse" v={dateFmt(app.responseDate)} />
        <Row k="Résultat" v={app.outcome === "accorde" ? "Accordé 🎉" : app.outcome === "refuse" ? "Refusé" : "En attente"} />
      </dl>
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={() => router.push("/contribute")}>
          Modifier / compléter
        </Button>
      </div>
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
