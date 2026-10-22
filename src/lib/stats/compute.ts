import { WAIT_BUCKETS, MIN_SAMPLE_SIZE } from "../constants";
import type { BaseRow } from "./base";

export type { BaseRow };

export function parseMonth(d: string): string {
  return d.slice(0, 7);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Preferred docs-based wait; falls back to appointment-based with explicit basis. */
export function waitOf(row: BaseRow): { days: number; basis: "documents" | "rendezvous" } | null {
  if (!row.response) return null;
  if (row.docsSent && dayDiff(row.response, row.docsSent) >= 0) {
    return { days: dayDiff(row.response, row.docsSent), basis: "documents" };
  }
  if (row.appointment && dayDiff(row.response, row.appointment) >= 0) {
    return { days: dayDiff(row.response, row.appointment), basis: "rendezvous" };
  }
  return null;
}

export function currentWaitOf(row: BaseRow): { days: number; basis: "documents" | "rendezvous" } | null {
  const today = todayStr();
  if (row.docsSent && dayDiff(today, row.docsSent) >= 0) {
    return { days: dayDiff(today, row.docsSent), basis: "documents" };
  }
  if (row.appointment && dayDiff(today, row.appointment) >= 0) {
    return { days: dayDiff(today, row.appointment), basis: "rendezvous" };
  }
  return null;
}

export function sortAsc(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/** percentile_cont-style linear interpolation */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function medianW(min: number[]): number {
  return percentile(sortAsc(min), 0.5);
}

/** Tukey fences (Q1 - 3*IQR, Q3 + 3*IQR); returns filtered copy */
export function tukeyTrim(values: number[]): number[] {
  if (values.length < 8) return values;
  const s = sortAsc(values);
  const q1 = percentile(s, 0.25);
  const q3 = percentile(s, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 3 * iqr;
  const hi = q3 + 3 * iqr;
  return values.filter((v) => v >= lo && v <= hi);
}

export function dayLabel(iso: string): string {
  return iso.slice(0, 10);
}

/* ---------- Chart computations (pure) ---------- */

export type WaitTrendPoint = {
  month: string;
  mean: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  n: number;
  appointmentBasedN: number;
};

export function c1WaitTrend(rows: BaseRow[]): { months: WaitTrendPoint[]; period: [string, string] | null } {
  const byMonth = new Map<string, { docs: number[]; mixed: number[] }>();
  let min = null as string | null;
  let max = null as string | null;
  for (const r of rows) {
    const w = waitOf(r);
    if (!w) continue;
    const m = parseMonth(r.response!);
    const b = byMonth.get(m) ?? { docs: [], mixed: [] };
    if (w.basis === "documents") b.docs.push(w.days);
    else b.mixed.push(w.days);
    byMonth.set(m, b);
    if (min === null || r.response! < min) min = r.response!;
    if (max === null || r.response! > max) max = r.response!;
  }
  const months = [...byMonth.keys()].sort().map((m) => {
    const b = byMonth.get(m)!;
    const s = sortAsc(b.docs);
    const clean = tukeyTrim(b.docs);
    return {
      month: m,
      mean: clean.length ? Math.round((clean.reduce((x, y) => x + y, 0) / clean.length) * 10) / 10 : null,
      median: s.length ? Math.round(percentile(s, 0.5) * 10) / 10 : null,
      p25: s.length ? Math.round(percentile(s, 0.25) * 10) / 10 : null,
      p75: s.length ? Math.round(percentile(s, 0.75) * 10) / 10 : null,
      n: b.docs.length,
      appointmentBasedN: b.mixed.length,
    };
  });
  return { months, period: min && max ? [min, max] : null };
}

export type OutcomePoint = { month: string; accorde: number; refuse: number; total: number };

export function c2Outcomes(rows: BaseRow[]): { byMonth: OutcomePoint[]; totals: { accorde: number; refuse: number; enAttente: number; n: number } } {
  const byMonth = new Map<string, OutcomePoint>();
  const totals = { accorde: 0, refuse: 0, enAttente: 0, n: 0 };
  for (const r of rows) {
    totals.n++;
    if (r.outcome === "accorde") {
      totals.accorde++;
    } else if (r.outcome === "refuse") {
      totals.refuse++;
    } else {
      totals.enAttente++;
      continue;
    }
    const m = parseMonth(r.response!);
    const pt = byMonth.get(m) ?? { month: m, accorde: 0, refuse: 0, total: 0 };
    pt.total++;
    if (r.outcome === "accorde") pt.accorde++;
    else pt.refuse++;
    byMonth.set(m, pt);
  }
  return { byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)), totals };
}

export type HistPoint = { bucket: string; count: number; pct: number };

export function bucketizeWaits(waits: number[]): HistPoint[] {
  const counts = new Map<string, number>();
  for (const bucket of WAIT_BUCKETS.map((b) => b[0])) counts.set(bucket, 0);
  for (const w of waits) {
    const b = WAIT_BUCKETS.find(([, lo, hi]) => w >= lo && w <= hi);
    if (b) counts.set(b[0], (counts.get(b[0]) ?? 0) + 1);
  }
  const total = waits.length || 1;
  return WAIT_BUCKETS.map(([name]) => ({
    bucket: name,
    count: counts.get(name) ?? 0,
    pct: Math.round(((counts.get(name) ?? 0) / total) * 1000) / 10,
  }));
}

export function c3WaitHistogram(rows: BaseRow[]): { hist: HistPoint[]; waitedLongerThanYou: number | null } {
  const waits = rows.map(waitOf).filter((w): w is { days: number; basis: "documents" } => !!w && w.basis === "documents").map((w) => w.days);
  return { hist: bucketizeWaits(waits), waitedLongerThanYou: null };
}

export function c4AppointmentCalendar(
  rows: BaseRow[],
  mode: "rendezvous" | "reservation"
): { days: { date: string; count: number }[] } {
  const key = mode === "rendezvous" ? (r: BaseRow) => r.appointment : (r: BaseRow) => r.bookedOn;
  const counts = new Map<string, number>();
  const today = todayStr();
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  for (const r of rows) {
    const d = key(r);
    if (d && d >= from && d <= to) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  // fill calendar span
  const days: { date: string; count: number }[] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    days.push({ date: iso, count: counts.get(iso) ?? 0 });
    cur = new Date(cur.getTime() + 86400000);
  }
  void today;
  return { days };
}

export type FunnelData = { steps: { key: string; label: string; count: number }[] };

export function c5Funnel(rows: BaseRow[]): FunnelData {
  const docs = rows.filter((r) => r.docsSent).length;
  const appt = rows.filter((r) => r.appointment).length;
  const resp = rows.filter((r) => r.response).length;
  const ok = rows.filter((r) => r.outcome === "accorde").length;
  return {
    steps: [
      { key: "dossiers_envoyés", label: "Dossiers envoyés", count: docs },
      { key: "rendezvous_passés", label: "RDV/empreintes passés", count: appt },
      { key: "réponses_recieved", label: "Réponses reçues", count: resp },
      { key: "visas_accordés", label: "Visas accordés", count: ok },
    ],
  };
}

export function c6SlotRelease(rows: BaseRow[]): { heatmap: { weekday: number; month: string; count: number }[]; partOfDay: { weekday: number; slot: string; count: number }[] } {
  const wd = new Map<string, number>();
  const pod = new Map<string, number>();
  for (const r of rows) {
    if (r.bookedOn) {
      const d = new Date(`${r.bookedOn}T00:00:00Z`);
      const weekday = d.getUTCDay();
      const month = r.bookedOn.slice(0, 7);
      const k = `${weekday}|${month}`;
      wd.set(k, (wd.get(k) ?? 0) + 1);
      if (r.appointment) {
        const key2 = r.slot ?? "inconnu";
        const k2 = `${weekday}|${key2}`;
        pod.set(k2, (pod.get(k2) ?? 0) + 1);
      }
    }
  }
  return {
    heatmap: [...wd.entries()].map(([k, count]) => {
      const [weekday, month] = k.split("|");
      return { weekday: Number(weekday), month, count };
    }).sort((a, b) => a.month.localeCompare(b.month) || a.weekday - b.weekday),
    partOfDay: [...pod.entries()].map(([k, count]) => {
      const [weekday, slot] = k.split("|");
      return { weekday: Number(weekday), slot, count };
    }),
  };
}

export type CenterStat = { centerId: number; median: number; p25: number; p75: number; mean: number; n: number };

export function c7WaitByCenter(rows: BaseRow[]): CenterStat[] {
  const byCenter = new Map<number, number[]>();
  for (const r of rows) {
    const w = waitOf(r);
    if (!w || w.basis !== "documents") continue;
    const arr = byCenter.get(r.centerId) ?? [];
    arr.push(w.days);
    byCenter.set(r.centerId, arr);
  }
  return [...byCenter.entries()].map(([centerId, arr]) => {
    const s = sortAsc(arr);
    const trimmed = tukeyTrim(arr);
    return {
      centerId,
      median: Math.round(percentile(s, 0.5) * 10) / 10,
      p25: Math.round(percentile(s, 0.25) * 10) / 10,
      p75: Math.round(percentile(s, 0.75) * 10) / 10,
      mean: trimmed.length ? Math.round((trimmed.reduce((a, b) => a + b, 0) / trimmed.length) * 10) / 10 : 0,
      n: s.length,
    };
  });
}

export function c8ApprovalByCenter(rows: BaseRow[]): { centerId: number; approvedPct: number; n: number }[] {
  const byCenter = new Map<number, { acc: number; total: number }>();
  for (const r of rows) {
    if (!r.response) continue;
    const b = byCenter.get(r.centerId) ?? { acc: 0, total: 0 };
    b.total++;
    if (r.outcome === "accorde") b.acc++;
    byCenter.set(r.centerId, b);
  }
  return [...byCenter.entries()].map(([centerId, b]) => ({
    centerId,
    approvedPct: b.total ? Math.round((b.acc / b.total) * 100) : 0,
    n: b.total,
  }));
}

/** Kaplan–Meier curve, censored at current date for pending cases */
export function c9Survival(rows: BaseRow[]): { steps: { t: number; s: number; atRisk: number; ended: number }[] } {
  type T = { time: number; ended: boolean };
  const obs: T[] = [];
  const today = todayStr();
  for (const r of rows) {
    if (!r.docsSent) continue;
    if (r.response) {
      const d = dayDiff(r.response, r.docsSent);
      if (d >= 0) obs.push({ time: d, ended: true });
    } else {
      const d = dayDiff(today, r.docsSent);
      if (d >= 0 && d <= 3650) obs.push({ time: d, ended: false });
    }
  }
  const eventTimes = [...new Set(obs.filter((o) => o.ended).map((o) => o.time))].sort((a, b) => a - b);
  const steps: { t: number; s: number; atRisk: number; ended: number }[] = [];
  let s = 1;
  for (const t of eventTimes) {
    if (t > 150) break;
    const atRisk = obs.filter((o) => o.time >= t).length;
    const ended = obs.filter((o) => o.ended && o.time === t).length;
    if (atRisk > 0) {
      s *= 1 - ended / atRisk;
      steps.push({ t, s: Math.max(0, Math.round(s * 1000) / 1000), atRisk, ended });
    }
  }
  return { steps };
}

export function c10OutcomeByWait(rows: BaseRow[]): { buckets: string[]; data: { bucket: string; accorde: number; refuse: number }[] } {
  const responded = rows
    .map((r) => ({ r, w: waitOf(r) }))
    .filter((x) => !!x.w && x.w.basis === "documents" && (x.r.outcome === "accorde" || x.r.outcome === "refuse"));
  const data = WAIT_BUCKETS.map(([name, lo, hi]) => {
    const inBucket = responded.filter((x) => x.w!.days >= lo && x.w!.days <= hi);
    return {
      bucket: name,
      accorde: inBucket.filter((x) => x.r.outcome === "accorde").length,
      refuse: inBucket.filter((x) => x.r.outcome === "refuse").length,
    };
  });
  return { buckets: WAIT_BUCKETS.map((b) => b[0]), data };
}

export function isoWeekOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function c11CohortTable(rows: BaseRow[]): { weeks: { week: string; n: number; answeredPct: number; approvedPct: number; medianWait: number | null }[] } {
  const byWeek = new Map<string, { n: number; answered: number; approved: number; waits: number[] }>();
  for (const r of rows) {
    if (!r.docsSent) continue;
    const w = isoWeekOf(r.docsSent);
    const b = byWeek.get(w) ?? { n: 0, answered: 0, approved: 0, waits: [] };
    b.n++;
    if (r.response) {
      b.answered++;
      const d = dayDiff(r.response, r.docsSent);
      if (d >= 0) b.waits.push(d);
      if (r.outcome === "accorde") b.approved++;
    }
    byWeek.set(w, b);
  }
  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, b]) => ({
      week,
      n: b.n,
      answeredPct: Math.round((b.answered / Math.max(1, b.n)) * 100),
      approvedPct: Math.round((b.approved / Math.max(1, b.n)) * 100),
      medianWait: b.waits.length ? Math.round(percentile(sortAsc(b.waits), 0.5) * 10) / 10 : null,
    }));
  return { weeks };
}

/** Daily cohort table for one calendar month (YYYY-MM), based on the day files were sent. */
export function c11CohortDaily(
  rows: BaseRow[],
  viewMonth?: string | null
): { month: string; days: { date: string; n: number; answeredPct: number; approvedPct: number; medianWait: number | null }[] } {
  const current = todayStr().slice(0, 7);
  const month = viewMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(viewMonth) ? viewMonth : current;
  const byDay = new Map<string, { n: number; answered: number; approved: number; waits: number[] }>();
  for (const r of rows) {
    if (!r.docsSent || r.docsSent.slice(0, 7) !== month) continue;
    const b = byDay.get(r.docsSent) ?? { n: 0, answered: 0, approved: 0, waits: [] };
    b.n++;
    if (r.response) {
      b.answered++;
      const d = dayDiff(r.response, r.docsSent);
      if (d >= 0) b.waits.push(d);
      if (r.outcome === "accorde") b.approved++;
    }
    byDay.set(r.docsSent, b);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({
      date,
      n: b.n,
      answeredPct: Math.round((b.answered / Math.max(1, b.n)) * 100),
      approvedPct: Math.round((b.approved / Math.max(1, b.n)) * 100),
      medianWait: b.waits.length ? Math.round(percentile(sortAsc(b.waits), 0.5) * 10) / 10 : null,
    }));
  return { month, days };
}

export function c12ResponseTimeline(rows: BaseRow[], days = 90): { data: { date: string; count: number }[] } {
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.response && r.response >= from) counts.set(r.response, (counts.get(r.response) ?? 0) + 1);
  }
  const data: { date: string; count: number }[] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${todayStr()}T00:00:00Z`);
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10);
    data.push({ date: iso, count: counts.get(iso) ?? 0 });
    cur = new Date(cur.getTime() + 86400000);
  }
  return { data };
}

export function c13AppointmentToResponse(rows: BaseRow[]): { hist: HistPoint[] } {
  const waits: number[] = [];
  for (const r of rows) {
    if (r.appointment && r.response) {
      const d = dayDiff(r.response, r.appointment);
      if (d >= 0) waits.push(d);
    }
  }
  return { hist: bucketizeWaits(waits) };
}

export function c14RejectionReasons(rows: BaseRow[]): { reasons: { reason: string; count: number; share: number }[]; n: number } {
  const refused = rows.filter((r) => r.outcome === "refuse");
  const byReason = new Map<string, number>();
  for (const r of refused) {
    const reason = r.rejectionReason ?? "non_precise";
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  const n = refused.length;
  return {
    reasons: [...byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count, share: Math.round((count / Math.max(1, n)) * 100) })),
    n,
  };
}

export function c15ApprovalByIntake(rows: BaseRow[]): { intakes: { intake: string; approvedPct: number; medianWait: number | null; n: number }[] } {
  const byIntake = new Map<string, { n: number; approved: number; responded: number; waits: number[] }>();
  for (const r of rows) {
    const b = byIntake.get(r.intake) ?? { n: 0, approved: 0, responded: 0, waits: [] };
    b.n++;
    if (r.response) {
      b.responded++;
      if (r.outcome === "accorde") {
        b.approved++;
        const w = waitOf(r);
        if (w && w.basis === "documents") b.waits.push(w.days);
      }
    }
    byIntake.set(r.intake, b);
  }
  return {
    intakes: [...byIntake.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([intake, b]) => ({
      intake,
      approvedPct: b.responded ? Math.round((b.approved / b.responded) * 100) : 0,
      medianWait: b.waits.length ? Math.round(percentile(sortAsc(b.waits), 0.5) * 10) / 10 : null,
      n: b.n,
    })),
  };
}

const LEAD_BUCKETS: [string, number, number][] = [
  ["1-7", 1, 7],
  ["8-14", 8, 14],
  ["15-30", 15, 30],
  ["31-60", 31, 60],
  ["61-90", 61, 90],
  ["91+", 91, 100000],
];

export function c17LeadTime(rows: BaseRow[]): { hist: HistPoint[] } {
  const leads: number[] = [];
  for (const r of rows) {
    if (r.bookedOn && r.appointment) {
      const d = dayDiff(r.appointment, r.bookedOn);
      if (d > 0) leads.push(d);
    }
  }
  const counts = new Map<string, number>();
  for (const b of LEAD_BUCKETS.map((b) => b[0])) counts.set(b, 0);
  for (const l of leads) {
    const b = LEAD_BUCKETS.find(([, lo, hi]) => l >= lo && l <= hi);
    if (b) counts.set(b[0], (counts.get(b[0]) ?? 0) + 1);
  }
  const total = leads.length || 1;
  return {
    hist: LEAD_BUCKETS.map(([name]) => ({
      bucket: name,
      count: counts.get(name) ?? 0,
      pct: Math.round(((counts.get(name) ?? 0) / total) * 1000) / 10,
    })),
  };
}

/* ---------- Study level & submissions ---------- */

/** Approved visas grouped by study level (master vs licence). */
export function c18ApprovedByLevel(rows: BaseRow[]): { levels: { level: string; count: number }[] } {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.outcome !== "accorde") continue;
    const level = r.studyLevel === "master" || r.studyLevel === "licence" ? r.studyLevel : "non_precise";
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  const levels = ["master", "licence", "non_precise"]
    .map((level) => ({ level, count: counts.get(level) ?? 0 }))
    .filter((l) => l.level !== "non_precise" || l.count > 0);
  return { levels };
}

/** Daily count of dossiers sent to the embassy (docs_sent_date), zero-filled. */
export function c19DocsSentTimeline(rows: BaseRow[]): { data: { date: string; count: number }[] } {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.docsSent) counts.set(r.docsSent, (counts.get(r.docsSent) ?? 0) + 1);
  }
  const dates = [...counts.keys()].sort();
  if (dates.length === 0) return { data: [] };
  const today = todayStr();
  const start = dates[0];
  const end = dates[dates.length - 1] < today ? dates[dates.length - 1] : today;
  if (start > end) return { data: [] };
  const data: { date: string; count: number }[] = [];
  let cur = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  while (cur <= endDate) {
    const iso = cur.toISOString().slice(0, 10);
    data.push({ date: iso, count: counts.get(iso) ?? 0 });
    cur = new Date(cur.getTime() + 86400000);
  }
  return { data };
}

/** Monthly lifecycle: applications created, files sent to the embassy, responses — split master/licence. */
export type LifecycleSeries = {
  level: "master" | "licence";
  demande: number[];
  envoi: number[];
  reponse: number[];
};

export function c20LifecycleTimeline(rows: BaseRow[]): { months: string[]; series: LifecycleSeries[] } {
  const events: { level: "master" | "licence"; key: "demande" | "envoi" | "reponse"; month: string }[] = [];
  for (const r of rows) {
    const level = r.studyLevel === "master" || r.studyLevel === "licence" ? r.studyLevel : null;
    if (!level) continue;
    const created = r.createdAt.slice(0, 7);
    if (created) events.push({ level, key: "demande", month: created });
    if (r.docsSent) events.push({ level, key: "envoi", month: r.docsSent.slice(0, 7) });
    if (r.response) events.push({ level, key: "reponse", month: r.response.slice(0, 7) });
  }
  if (events.length === 0) return { months: [], series: [] };
  const months = [...new Set(events.map((e) => e.month))].sort();
  const forLevel = (level: "master" | "licence"): LifecycleSeries => {
    const arr = (key: "demande" | "envoi" | "reponse") =>
      months.map((m) => events.filter((e) => e.level === level && e.key === key && e.month === m).length);
    return { level, demande: arr("demande"), envoi: arr("envoi"), reponse: arr("reponse") };
  };
  return { months, series: [forLevel("master"), forLevel("licence")] };
}

/** Daily lifecycle counters for one calendar month (YYYY-MM), split master/licence. */
export type LifecycleDayCell = { demande: number; envoi: number; reponse: number };

export function c21LifecycleDaily(
  rows: BaseRow[],
  viewMonth?: string | null
): { month: string; days: { date: string; master: LifecycleDayCell; licence: LifecycleDayCell }[] } {
  const current = todayStr().slice(0, 7);
  const month = viewMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(viewMonth) ? viewMonth : current;
  const [year, mon] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const empty = (): LifecycleDayCell => ({ demande: 0, envoi: 0, reponse: 0 });
  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    master: empty(),
    licence: empty(),
  }));
  for (const r of rows) {
    const level: "master" | "licence" | null =
      r.studyLevel === "master" ? "master" : r.studyLevel === "licence" ? "licence" : null;
    if (!level) continue;
    const push = (date: string | null, key: keyof LifecycleDayCell) => {
      if (!date || date.slice(0, 7) !== month) return;
      const i = Number(date.slice(8, 10)) - 1;
      if (i >= 0 && i < daysInMonth) days[i][level][key]++;
    };
    push(r.createdAt.slice(0, 10), "demande");
    push(r.docsSent, "envoi");
    push(r.response, "reponse");
  }
  return { month, days };
}

/* ---------- Benchmark helpers ---------- */

export function computeBenchmark(myWait: { days: number; basis: "documents" | "rendezvous" } | null, rows: BaseRow[]) {
  const basis = myWait?.basis ?? "documents";
  const comparable = rows
    .map((r) => waitOf(r))
    .filter((w): w is { days: number; basis: "documents" | "rendezvous" } => !!w && w.basis === basis)
    .map((w) => w.days);
  const n = comparable.length;
  if (n < MIN_SAMPLE_SIZE) return { insufficient: true, n, longerPct: null, median: null, p25: null, p75: null, p90: null };
  const s = sortAsc(comparable);
  return {
    insufficient: false,
    n,
    longerPct: myWait ? Math.round((comparable.filter((d) => d > myWait.days).length / n) * 100) : null,
    median: Math.round(percentile(s, 0.5) * 10) / 10,
    p25: Math.round(percentile(s, 0.25) * 10) / 10,
    p75: Math.round(percentile(s, 0.75) * 10) / 10,
    p90: Math.round(percentile(s, 0.9) * 10) / 10,
  };
}

/* ---------- Stage helpers ---------- */

export function computedStage(r: BaseRow): "inscrit" | "soumis" | "reponse" {
  if (r.response) return "reponse";
  if (r.docsSent) return "soumis";
  return "inscrit";
}

export function weeksSince(iso: string): number {
  return Math.floor(dayDiff(todayStr(), iso) / 7);
}
