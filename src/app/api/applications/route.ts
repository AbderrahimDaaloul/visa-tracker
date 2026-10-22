import { apiError, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import {
  FIXED_CENTER_NAME,
  FIXED_VISA_TYPE,
  MAX_CONTRIBUTIONS_PER_DAY,
  defaultIntake,
} from "@/lib/constants";
import { ensureDb } from "@/lib/db/init";
import { applications, centers, events } from "@/lib/db/schema";
import { createApplicationSchema } from "@/lib/validation";
import { and, eq, ne } from "drizzle-orm";
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

    const centerRows = await db
      .select()
      .from(centers)
      .where(eq(centers.name, FIXED_CENTER_NAME))
      .limit(1);
    const center = centerRows[0];
    if (!center) return apiError("Le centre Almaviva Tunisie n'est pas configuré.", 503);

    const intake = defaultIntake();
    const existing = await db
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.userId, user.id), ne(applications.status, "supprime")))
      .limit(1);
    if (existing[0]) {
      return apiError("Vous avez déjà une candidature. Modifiez-la au lieu d'en créer une nouvelle.", 409);
    }
    const inserted = await db
      .insert(applications)
      .values({
        userId: user.id,
        centerId: center.id,
        visaType: FIXED_VISA_TYPE,
        intake,
        studyLevel: body.studyLevel,
        fieldOfStudy: null,
      })
      .returning();
    await db.insert(events).values({
      applicationId: inserted[0].id,
      type: "creation",
      payload: { centerId: center.id, visaType: FIXED_VISA_TYPE, intake, studyLevel: body.studyLevel },
    });
    return json({ application: inserted[0] }, 201);
  });
}
