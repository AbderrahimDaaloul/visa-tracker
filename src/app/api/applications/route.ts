import { apiError, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MAX_ACTIVE_APPLICATIONS, MAX_CONTRIBUTIONS_PER_DAY } from "@/lib/constants";
import { ensureDb } from "@/lib/db/init";
import { applications, events } from "@/lib/db/schema";
import { createApplicationSchema } from "@/lib/validation";
import { and, eq, sql } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    if (!rateLimit(`app-create:${user.id}`, MAX_CONTRIBUTIONS_PER_DAY, 86400000)) {
      return apiError(`Limite de ${MAX_CONTRIBUTIONS_PER_DAY} contributions par jour atteinte.`, 429);
    }
    const body = createApplicationSchema.parse(await readJsonBody(req));
    const db = await ensureDb();

    const dup = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.userId, user.id),
          eq(applications.centerId, body.centerId),
          eq(applications.intake, body.intake),
          eq(applications.status, "actif")
        )
      )
      .limit(1);
    if (dup[0]) {
      return apiError("Vous avez déjà une candidature active pour ce centre et cette intake.", 409);
    }
    const activeCount = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .where(and(eq(applications.userId, user.id), eq(applications.status, "actif")));
    if ((activeCount[0]?.n ?? 0) >= MAX_ACTIVE_APPLICATIONS) {
      return apiError(`Maximum ${MAX_ACTIVE_APPLICATIONS} candidatures actives.`, 409);
    }
    const inserted = await db
      .insert(applications)
      .values({
        userId: user.id,
        centerId: body.centerId,
        visaType: body.visaType,
        intake: body.intake,
        studyLevel: body.studyLevel ?? null,
        fieldOfStudy: body.fieldOfStudy ?? null,
      })
      .returning();
    await db.insert(events).values({
      applicationId: inserted[0].id,
      type: "creation",
      payload: body,
    });
    return json({ application: inserted[0] }, 201);
  });
}
