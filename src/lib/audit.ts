import type { AppDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";

export async function auditLogAction(
  db: AppDb,
  actor: { id: string; role: string },
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  console.info(`[audit] role=${actor.role} action=${action} ${JSON.stringify(detail)}`);
  try {
    await db.insert(auditLog).values({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      detail,
    });
  } catch (error) {
    console.error("[audit] écriture impossible", error);
  }
}
