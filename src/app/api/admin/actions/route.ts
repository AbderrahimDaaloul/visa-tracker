import { apiError, json, readJsonBody, withApi } from "@/lib/api";
import { requireRole } from "@/lib/adminGuard";
import { ensureDb } from "@/lib/db/init";
import { auditLog } from "@/lib/audit";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const role = await requireRole(["admin", "moderator"]);
    const body = await readJsonBody<{
      action: string;
      applicationId?: string;
      userId?: string;
      flagId?: number;
      decision?: string;
    }>(req);
    const db = await ensureDb();
    const { applicationId, userId, flagId, decision } = body as unknown as { applicationId?: string; userId?: string; flagId?: number; decision?: string };
    switch (body.action) {
      case "hide":
      case "unhide":
      case "delete": {
        if (!applicationId) return apiError("applicationId requis.");
        const status = body.action === "hide" ? "cache" : body.action === "unhide" ? "actif" : "supprime";
        await db.execute(`UPDATE applications SET status = '${status}' WHERE id = '${applicationId}'`);
        await auditLog(db, role, body.action, { applicationId });
        break;
      }
      case "ban":
      case "unban": {
        if (!userId) return apiError("userId requis.");
        if (body.action === "ban") {
          await db.execute(`UPDATE users SET banned_at = now() WHERE id = '${userId}'`);
          await db.execute(`DELETE FROM sessions WHERE user_id = '${userId}'`);
        } else {
          await db.execute(`UPDATE users SET banned_at = NULL WHERE id = '${userId}'`);
        }
        await auditLog(db, role, body.action, { userId });
        break;
      }
      case "resolve_flag": {
        if (!flagId) return apiError("flagId requis.");
        const statusFlag = decision === "confirmee" ? "confirmee" : "rejete";
        await db.execute(`UPDATE flags SET status = '${statusFlag}', resolved_at = now() WHERE id = ${flagId}`);
        if (statusFlag === "confirmee") {
          await db.execute(`
            UPDATE applications SET status = 'cache'
            WHERE id = (SELECT application_id FROM flags WHERE id = ${flagId})
          `);
        } else {
          await db.execute(`
            UPDATE applications SET status = 'actif'
            WHERE id = (SELECT application_id FROM flags WHERE id = ${flagId})
              AND status = 'cache'
              AND (SELECT count(*) FROM flags f2 WHERE f2.application_id = applications.id AND f2.status = 'confirmee') = 0
          `);
        }
        await auditLog(db, role, `flag_${statusFlag}`, { flagId });
        break;
      }
      default:
        return apiError("Action inconnue.");
    }
    return json({ ok: true });
  });
}
