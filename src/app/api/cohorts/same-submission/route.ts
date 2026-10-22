import { apiError, json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedApplication } from "@/lib/applications";
import { ensureDb } from "@/lib/db/init";
import { rowsOf } from "@/lib/db/client";
import { MIN_SAMPLE_SIZE } from "@/lib/constants";
import { dayDiff, percentile, sortAsc, todayStr } from "@/lib/stats/compute";
import { sql } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function boundsFor(d: string, w: string): { from: string; to: string; label: string } {
  const dt = new Date(`${d}T00:00:00Z`);
  if (w === "trois_jours") {
    return {
      from: new Date(dt.getTime() - 3 * 86400000).toISOString().slice(0, 10),
      to: new Date(dt.getTime() + 3 * 86400000).toISOString().slice(0, 10),
      label: "±3 jours",
    };
  }
  if (w === "semaine") {
    const day = dt.getUTCDay() || 7;
    const monday = new Date(dt);
    monday.setUTCDate(dt.getUTCDate() - (day - 1));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10),
      label: "Même semaine",
    };
  }
  if (w === "mois") {
    return {
      from: d.slice(0, 7) + "-01",
      to: new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
      label: "Même mois",
    };
  }
  return { from: d, to: d, label: "Même date" };
}

export async function GET(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const applicationId = url.searchParams.get("applicationId");
    const windowParam = url.searchParams.get("window") ?? "exact";
    if (!["exact", "trois_jours", "semaine", "mois"].includes(windowParam)) {
      return apiError("Fenêtre invalide.");
    }
    if (!applicationId) return apiError("applicationId requis.");
    const app = await getOwnedApplication(user.id, applicationId);
    if (!app || app.status === "supprime") return apiError("Candidature introuvable.", 404);
    if (!app.docsSentDate) return apiError("Cette candidature n'a pas encore de date d'envoi des documents.", 400);

    let bounds = boundsFor(app.docsSentDate, windowParam);
    let expanded = false;
    const db = await ensureDb();
    const fetchCohort = async () => {
      const q = await db.execute(sql`
        SELECT u.pseudo_lower AS pseudo_lower, u.show_pseudo_in_cohorts AS show_pseudo,
               a.response_date, a.outcome, a.docs_sent_date
        FROM applications a JOIN users u ON u.id = a.user_id
        WHERE a.status = 'actif' AND a.center_id = ${app.centerId}
          AND a.docs_sent_date >= ${bounds.from}::date AND a.docs_sent_date <= ${bounds.to}::date
          AND u.banned_at IS NULL
      `);
      return rowsOf<{
        pseudo_lower: string; show_pseudo: boolean; response_date: string | null; outcome: string; docs_sent_date: string;
      }>(q);
    };
    let rows = await fetchCohort();
    if (rows.length < MIN_SAMPLE_SIZE && windowParam === "exact") {
      bounds = boundsFor(app.docsSentDate, "trois_jours");
      expanded = true;
      rows = await fetchCohort();
    }

    const today = todayStr();
    if (rows.length < MIN_SAMPLE_SIZE) {
      return json({
        window: bounds.label,
        n: rows.length,
        expanded,
        insufficientData: true,
        updatedAt: new Date().toISOString(),
        daysSinceSent: dayDiff(today, app.docsSentDate),
        data: null,
      });
    }
    const answers = rows.filter((r) => r.response_date).map((r) => dayDiff(r.response_date!, r.docs_sent_date));
    const medianWait = answers.length ? percentile(sortAsc(answers), 0.5) : null;
    // mini timeline: responses per day since submission
    const timeline = new Map<string, number>();
    for (const r of rows) {
      if (!r.response_date) continue;
      const d = dayDiff(r.response_date, r.docs_sent_date);
      if (d >= 0) timeline.set(String(d), (timeline.get(String(d)) ?? 0) + 1);
    }
    return json({
      window: bounds.label,
      n: rows.length,
      expanded,
      insufficientData: false,
      updatedAt: new Date().toISOString(),
      daysSinceSent: dayDiff(today, app.docsSentDate),
      data: {
        answeredPct: Math.round((answers.length / Math.max(1, rows.length)) * 100),
        approvedPct: Math.round((rows.filter((r) => r.outcome === "accorde").length / Math.max(1, rows.length)) * 100),
        medianWaitSoFar: medianWait === null ? null : Math.round(medianWait),
        timeline: [...timeline.entries()]
          .map(([days, count]) => ({ days: Number(days), count }))
          .sort((a, b) => a.days - b.days),
        respondedNews: rows
          .filter((r) => r.show_pseudo && r.response_date)
          .slice(0, 20)
          .map((r) => ({ pseudo: r.pseudo_lower, days: dayDiff(r.response_date!, r.docs_sent_date), approved: r.outcome === "accorde" })),
      },
    });
  });
}
