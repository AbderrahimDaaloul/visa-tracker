import { apiError, json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDb } from "@/lib/db/init";
import { applications } from "@/lib/db/schema";
import { fetchBaseRows, type BaseRow } from "@/lib/stats/base";
import { computeBenchmark, currentWaitOf, waitOf } from "@/lib/stats/compute";
import { and, eq } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const applicationId = url.searchParams.get("applicationId");
    if (!applicationId) return apiError("applicationId requis.");
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, user.id)))
      .limit(1);
    const app = rows[0];
    if (!app || app.status === "supprime") return apiError("Candidature introuvable.", 404);

    const sameCenterRows = await fetchBaseRows({ centerId: app.centerId });
    const basis = (app.responseDate ? waitOf(toRow(app)) : currentWaitOf(toRow(app)))?.basis ?? "documents";
    const bench = computeBenchmark(
      app.responseDate ? waitOf(toRow(app)) : currentWaitOf(toRow(app)),
      filterBasis(sameCenterRows, basis)
    );
    const fallbackRows = await fetchBaseRows({});
    const benchGlobal = computeBenchmark(
      app.responseDate ? waitOf(toRow(app)) : currentWaitOf(toRow(app)),
      filterBasis(fallbackRows, basis)
    );
    const chosen = !bench.insufficient ? bench : benchGlobal;
    const myW = app.responseDate ? waitOf(toRow(app)) : currentWaitOf(toRow(app));
    return json({
      applicationId,
      basis,
      myWaitDays: myW?.days ?? null,
      pending: !app.responseDate,
      n: chosen.n,
      usedFallback: bench.insufficient && !benchGlobal.insufficient,
      median: chosen.median ?? null,
      p25: chosen.p25 ?? null,
      p75: chosen.p75 ?? null,
      p90: chosen.p90 ?? null,
      longerPct: chosen.longerPct ?? null,
      insufficient: chosen.insufficient,
    });
  });
}

function filterBasis(rows: BaseRow[], basis: string): BaseRow[] {
  return rows.filter((r) => {
    const w = r.response ? waitOf(r) : currentWaitOf(r);
    return w && w.basis === basis;
  });
}

function toRow(r: typeof applications.$inferSelect): BaseRow {
  return {
    centerId: r.centerId,
    visaType: r.visaType,
    intake: r.intake,
    docsSent: r.docsSentDate,
    appointment: r.appointmentDate,
    bookedOn: r.slotBookedOn,
    slot: r.appointmentSlot,
    response: r.responseDate,
    outcome: r.outcome,
    rejectionReason: r.rejectionReason,
    createdAt: String(r.createdAt),
  };
}
