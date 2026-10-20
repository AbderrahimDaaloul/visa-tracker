import { apiError, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureDb } from "@/lib/db/init";
import { rowsOf } from "@/lib/db/client";
import { flags } from "@/lib/db/schema";
import { flagSchema } from "@/lib/validation";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    if (!rateLimit(`flag:${user.id}`, 20, 86400000)) return apiError("Trop de signalements.", 429);
    const body = flagSchema.parse(await readJsonBody(req));
    const db = await ensureDb();
    const exists = await db.execute(sql`SELECT 1 FROM applications a WHERE a.id = ${body.applicationId} AND a.status = 'actif'`);
    if (rowsOf(exists).length === 0) {
      return apiError("Candidature introuvable.", 404);
    }
    const mine = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(flags)
      .where(and(eq(flags.applicationId, body.applicationId), eq(flags.reporterId, user.id), isNull(flags.resolvedAt)));
    if ((mine[0]?.n ?? 0) > 0) return apiError("Vous avez déjà signalé cette entrée.", 409);
    const dupSelf = await db.execute(
      sql`SELECT 1 FROM applications WHERE id = ${body.applicationId} AND user_id = ${user.id}`
    );
    if (rowsOf(dupSelf).length > 0) {
      return apiError("Vous ne pouvez pas signaler votre propre contribution.", 400);
    }
    await db.insert(flags).values({ applicationId: body.applicationId, reporterId: user.id, reason: body.reason });
    const count = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(flags)
      .where(and(eq(flags.applicationId, body.applicationId), eq(flags.status, "ouvert")));
    if ((count[0]?.n ?? 0) >= 3) {
      await db.execute(sql`UPDATE applications SET status = 'cache' WHERE id = ${body.applicationId}`);
    }
    return json({ ok: true }, 201);
  });
}
