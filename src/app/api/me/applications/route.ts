import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDb } from "@/lib/db/init";
import { applications } from "@/lib/db/schema";
import { computedStage, currentWaitOf, dayDiff, todayStr, type BaseRow } from "@/lib/stats/compute";
import { eq, desc } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toBaseRow(r: typeof applications.$inferSelect): BaseRow {
  return {
    centerId: r.centerId,
    visaType: r.visaType,
    intake: r.intake,
    studyLevel: r.studyLevel,
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

export async function GET(): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(applications)
      .where(eq(applications.userId, user.id))
      .orderBy(desc(applications.createdAt))
      .limit(50);
    const today = todayStr();
    const apps = rows
      .filter((r) => r.status !== "supprime")
      .map((r) => ({
        id: r.id,
        centerId: r.centerId,
        visaType: r.visaType,
        intake: r.intake,
        studyLevel: r.studyLevel,
        appointmentDate: r.appointmentDate,
        appointmentSlot: r.appointmentSlot,
        slotBookedOn: r.slotBookedOn,
        docsSentDate: r.docsSentDate,
        docsSubmissionMode: r.docsSubmissionMode,
        outcome: r.outcome,
        responseDate: r.responseDate,
        rejectionReason: r.rejectionReason,
        status: r.status,
        createdAt: r.createdAt,
        stage: computedStage(toBaseRow(r)),
        currentWait: r.responseDate ? null : currentWaitOf(toBaseRow(r)),
        appointmentCountdownDays: r.appointmentDate ? dayDiff(r.appointmentDate, today) : null,
      }));
    return json({ applications: apps });
  });
}
