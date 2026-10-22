import { apiError, json, readJsonBody, withApi } from "@/lib/api";
import { requireRole } from "@/lib/adminGuard";
import { auditLogAction } from "@/lib/audit";
import { ensureDb } from "@/lib/db/init";
import { applications, flags, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const actor = await requireRole(["admin", "moderator"]);
    const body = await readJsonBody<{
      action: string;
      applicationId?: string;
      userId?: string;
      flagId?: number;
      decision?: string;
    }>(req);
    const db = await ensureDb();
    const { applicationId, userId, flagId, decision } = body;

    switch (body.action) {
      case "hide":
      case "unhide":
      case "delete": {
        if (!applicationId) return apiError("applicationId requis.");
        const found = await db
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.id, applicationId))
          .limit(1);
        if (!found[0]) return apiError("Candidature introuvable.", 404);
        const status = body.action === "hide" ? "cache" : body.action === "unhide" ? "actif" : "supprime";
        await db.update(applications).set({ status, updatedAt: new Date() }).where(eq(applications.id, applicationId));
        await auditLogAction(db, actor, body.action, { applicationId, status });
        break;
      }
      case "ban":
      case "unban": {
        if (!userId) return apiError("userId requis.");
        const target = await db
          .select({ id: users.id, pseudo: users.pseudo, role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (!target[0]) return apiError("Utilisateur introuvable.", 404);
        if (target[0].id === actor.id) return apiError("Vous ne pouvez pas vous bannir vous-même.", 400);
        if (actor.role === "moderator" && target[0].role !== "student") {
          return apiError("Un modérateur ne peut pas bannir un membre de l'équipe.", 403);
        }
        if (body.action === "ban") {
          await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, userId));
          await db.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);
        } else {
          await db.update(users).set({ bannedAt: null }).where(eq(users.id, userId));
        }
        await auditLogAction(db, actor, body.action, { userId, pseudo: target[0].pseudo });
        break;
      }
      case "resolve_flag": {
        if (!flagId) return apiError("flagId requis.");
        if (decision !== "confirmee" && decision !== "rejete") {
          return apiError("Décision invalide.");
        }
        const flag = await db
          .select({ id: flags.id, applicationId: flags.applicationId, status: flags.status })
          .from(flags)
          .where(eq(flags.id, flagId))
          .limit(1);
        if (!flag[0]) return apiError("Signalement introuvable.", 404);
        if (flag[0].status !== "ouvert") return apiError("Ce signalement a déjà été traité.", 409);

        await db
          .update(flags)
          .set({ status: decision, resolvedAt: new Date(), resolvedBy: actor.id })
          .where(eq(flags.id, flagId));

        if (decision === "confirmee") {
          await db
            .update(applications)
            .set({ status: "cache", updatedAt: new Date() })
            .where(eq(applications.id, flag[0].applicationId));
        } else {
          await db.execute(sql`
            UPDATE applications SET status = 'actif', updated_at = now()
            WHERE id = ${flag[0].applicationId}
              AND status = 'cache'
              AND NOT EXISTS (
                SELECT 1 FROM flags f2
                WHERE f2.application_id = ${flag[0].applicationId} AND f2.status = 'confirmee'
              )
          `);
        }
        await auditLogAction(db, actor, `flag_${decision}`, { flagId, applicationId: flag[0].applicationId });
        break;
      }
      default:
        return apiError("Action inconnue.");
    }
    return json({ ok: true });
  });
}
