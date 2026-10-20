import { apiError, json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getOwnedApplication } from "@/lib/applications";
import { ensureDb } from "@/lib/db/init";
import { rowsOf } from "@/lib/db/client";
import { dayDiff, medianW, todayStr } from "@/lib/stats/compute";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type Window = "exact" | "trois_jours" | "semaine" | "mois";

function dateWindow(d: string): { from: string; to: string; label: string } {
  const dt = new Date(`${d}T00:00:00Z`);
  const start = new Date(dt);
  start.setUTCDate(dt.getUTCDate() - 3);
  const end = new Date(dt);
  end.setUTCDate(dt.getUTCDate() + 3);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: "±3 jours" };
}

function windowBounds(d: string, w: Window): { from: string; to: string; label: string } {
  const dt = new Date(`${d}T00:00:00Z`);
  switch (w) {
    case "exact":
      return { from: d, to: d, label: "Même date" };
    case "trois_jours":
      return dateWindow(d);
    case "semaine": {
      const day = dt.getUTCDay() || 7;
      const monday = new Date(dt);
      monday.setUTCDate(dt.getUTCDate() - (day - 1));
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10), label: "Même semaine" };
    }
    case "mois":
      return {
        from: d.slice(0, 7) + "-01",
        to: new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).toISOString().slice(0, 10),
        label: "Même mois",
      };
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const applicationId = url.searchParams.get("applicationId");
    const windowParam = (url.searchParams.get("window") ?? "exact") as Window;
    if (!["exact", "trois_jours", "semaine", "mois"].includes(windowParam)) {
      return apiError("Fenêtre invalide.");
    }
    if (!applicationId) return apiError("applicationId requis.");
    const app = await getOwnedApplication(user.id, applicationId);
    if (!app || app.status === "supprime") return apiError("Candidature introuvable.", 404);
    if (!app.appointmentDate) return apiError("Cette candidature n'a pas encore de date de rendez-vous.", 400);

    let bounds = windowBounds(app.appointmentDate, windowParam);
    let expanded = false;
    if (!["exact", "trois_jours"].includes(windowParam)) {
      // handled after count check below
    }
    const db = await ensureDb();

    const fetchCohort = async (from: string, to: string) => {
      const q = await db.execute(`
        SELECT u.pseudo_lower AS pseudo_lower, u.show_pseudo_in_cohorts AS show_pseudo,
               a.docs_sent_date, a.response_date, a.outcome, a.appointment_date
        FROM applications a JOIN users u ON u.id = a.user_id
        WHERE a.status = 'actif' AND a.center_id = ${app!.centerId}
          AND a.appointment_date >= '${from}' AND a.appointment_date <= '${to}'
          AND u.banned_at IS NULL
      `);
      return rowsOf<{
          pseudo_lower: string;
          show_pseudo: boolean;
          docs_sent_date: string | null;
          response_date: string | null;
          outcome: string;
          appointment_date: string;
        }>(q);
    };

    bounds = windowBounds(app.appointmentDate, windowParam);
    let rows = await fetchCohort(bounds.from, bounds.to);
    if (rows.length < 5 && windowParam === "exact") {
      bounds = windowBounds(app.appointmentDate, "trois_jours");
      rows = await fetchCohort(bounds.from, bounds.to);
      expanded = true;
      void rows;
      if (rows.length < 5) {
        return json({
          window: bounds.label,
          n: rows.length,
          insufficientData: true,
          expanded,
          data: null,
        });
      }
    }

    const today = todayStr();
    const answered = rows.filter((r) => r.response_date);
    const approved = rows.filter((r) => r.outcome === "accorde");
    const rejected = rows.filter((r) => r.outcome === "refuse");
    const daysElapsed = rows.map((r) => dayDiff(today, r.appointment_date));
    const medianSinceAppointment = daysElapsed.length ? medianW(daysElapsed) : null;
    return json({
      window: bounds.label,
      n: rows.length,
      insufficientData: false,
      expanded,
      updatedAt: new Date().toISOString(),
      data: {
        funnel: {
          rendez_vous_passes: rows.length,
          dossiers_envoyes: rows.filter((r) => r.docs_sent_date).length,
          responses_recues: answered.length,
          accorde: approved.length,
          refuse: rejected.length,
        },
        medianSinceAppointment,
        daysElapsedMin: daysElapsed.length ? Math.min(...daysElapsed) : null,
        daysElapsedMax: daysElapsed.length ? Math.max(...daysElapsed) : null,
        rows: rows
          .filter((r) => r.show_pseudo || r.pseudo_lower === user.pseudo.toLowerCase())
          .map((r) => ({
            pseudo: r.pseudo_lower,
            status:
              r.response_date
                ? r.outcome === "accorde"
                  ? "accordé"
                  : "refusé"
                : r.docs_sent_date
                  ? "en attente (dossier envoyé)"
                  : "en attente",
            daysSinceAppointment: dayDiff(today, r.appointment_date),
          }))
          .slice(0, 30),
        hiddenRows: rows.filter((r) => !r.show_pseudo && r.pseudo_lower !== user.pseudo.toLowerCase()).length,
      },
    });
  });
}
