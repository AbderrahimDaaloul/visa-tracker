import { apiError, json, readJsonBody, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { applyContribution, type ContributionFields } from "@/lib/contribution";
import { ensureDb } from "@/lib/db/init";
import { applications, events } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadOwned(id: string) {
  const user = await requireUser();
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
    .limit(1);
  const app = rows[0];
  if (!app || app.status === "supprime") return null;
  return { db, app, user };
}

export async function PATCH(req: Request, ctx: RouteCtx): Promise<NextResponse> {
  return withApi(async () => {
    const { id } = await ctx.params;
    const owned = await loadOwned(id);
    if (!owned) return apiError("Candidature introuvable ou non autorisée.", 404);
    const fields = await readJsonBody<ContributionFields>(req);
    const { updates, warnings } = applyContribution(
      {
        appointmentDate: owned.app.appointmentDate,
        docsSentDate: owned.app.docsSentDate,
        responseDate: owned.app.responseDate,
        outcome: owned.app.outcome,
      },
      fields
    );
    if (Object.keys(updates).length > 0) {
      await owned.db
        .update(applications)
        .set({ ...(updates as Partial<typeof applications.$inferInsert>), updatedAt: new Date() })
        .where(eq(applications.id, owned.app.id));
    }
    await owned.db.insert(events).values({ applicationId: owned.app.id, type: "edition", payload: fields });
    return json({ ok: true, warnings });
  });
}

export async function DELETE(_req: Request, ctx: RouteCtx): Promise<NextResponse> {
  return withApi(async () => {
    const { id } = await ctx.params;
    const owned = await loadOwned(id);
    if (!owned) return apiError("Candidature introuvable ou non autorisée.", 404);
    await owned.db
      .update(applications)
      .set({ status: "supprime", updatedAt: new Date() })
      .where(eq(applications.id, owned.app.id));
    await owned.db.insert(events).values({ applicationId: owned.app.id, type: "suppression", payload: null });
    return json({ ok: true });
  });
}
