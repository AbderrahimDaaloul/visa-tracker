import { apiError, json, readJsonBody, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { applyContribution, type ContributionFields } from "@/lib/contribution";
import { ensureDb } from "@/lib/db/init";
import { applications, events } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
type RouteCtx = { params: Promise<{ id: string }> };
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CARD_TYPE_MAP: Record<string, keyof ContributionFields> = {
  rendez_vous: "appointmentDate",
  envoi_dossiers: "docsSentDate",
  reponse: "responseDate",
};

export async function POST(req: Request, ctx: RouteCtx): Promise<NextResponse> {
  return withApi(async () => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const db = await ensureDb();
    const rows = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
      .limit(1);
    const app = rows[0];
    if (!app || app.status === "supprime") return apiError("Candidature introuvable ou non autorisée.", 404);
    const body = await readJsonBody<{ type?: string } & ContributionFields>(req);
    const cardType = body.type && CARD_TYPE_MAP[body.type] ? body.type : null;
    if (!cardType) return apiError("Type d'événement invalide.");
    const fields: ContributionFields = { ...body };
    if (cardType === "rendez_vous" && !body.appointmentDate) {
      return apiError("Veuillez indiquer la date du rendez-vous.");
    }
    if (cardType === "envoi_dossiers" && !body.docsSentDate) {
      return apiError("Veuillez indiquer la date d'envoi des documents.");
    }
    if (cardType === "reponse" && !["accorde", "refuse"].includes(body.outcome ?? "")) {
      return apiError("Veuillez indiquer le résultat (accordé/refusé).");
    }
    if (cardType === "reponse" && !body.responseDate) {
      return apiError("Veuillez indiquer la date de réponse.");
    }
    if (cardType === "envoi_dossiers") {
      fields.appointmentDate = undefined;
      fields.responseDate = undefined;
      fields.outcome = undefined;
    }
    if (cardType === "rendez_vous") {
      fields.docsSentDate = undefined;
      fields.responseDate = undefined;
      fields.outcome = undefined;
    }
    const { updates, warnings } = applyContribution(
      {
        appointmentDate: app.appointmentDate,
        docsSentDate: app.docsSentDate,
        responseDate: app.responseDate,
        outcome: app.outcome,
      },
      fields
    );
    if (Object.keys(updates).length > 0) {
      await db
        .update(applications)
        .set({ ...(updates as Partial<typeof applications.$inferInsert>), updatedAt: new Date() })
        .where(eq(applications.id, app.id));
    }
    await db.insert(events).values({ applicationId: app.id, type: cardType, payload: fields });
    const counted = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .where(and(eq(applications.centerId, app.centerId), eq(applications.intake, app.intake), eq(applications.status, "actif")));
    return json({ ok: true, warnings, cohortSize: counted[0]?.n ?? 0 });
  });
}
