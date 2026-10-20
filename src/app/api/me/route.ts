import { apiError, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { getSessionUser, requireUser } from "@/lib/auth";
import { PSEUDO_CHANGE_DAYS } from "@/lib/constants";
import { ensureDb } from "@/lib/db/init";
import { notificationPrefs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PSEUDO_SCHEMA } from "@/lib/validation";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return withApi(async () => {
    const user = await getSessionUser();
    return json({ user });
  });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody<{
      pseudo?: string;
      language?: string;
      showPseudoInCohorts?: boolean;
      reminders?: boolean;
      cohortUpdates?: boolean;
    }>(req);
    const db = await ensureDb();
    const updates: Partial<typeof users.$inferInsert> = {};
    if (body.pseudo !== undefined) {
      const parsed = PSEUDO_SCHEMA.safeParse(body.pseudo);
      if (!parsed.success) return apiError("Pseudo invalide (3 à 20 caractères, lettres/chiffres/_).");
      const changedAt = user.pseudoChangedAt ?? new Date(user.createdAt);
      const days = (Date.now() - changedAt.getTime()) / 86400000;
      if (user.pseudo.toLowerCase() !== body.pseudo.toLowerCase() && days < PSEUDO_CHANGE_DAYS) {
        return apiError(`Vous pourrez changer de pseudo dans ${Math.ceil(PSEUDO_CHANGE_DAYS - days)} jours.`, 409);
      }
      const taken = await db.select().from(users).where(eq(users.pseudoLower, parsed.data.toLowerCase())).limit(1);
      if (taken[0] && taken[0].id !== user.id) return apiError("Ce pseudo est déjà pris.", 409);
      updates.pseudo = parsed.data;
      updates.pseudoLower = parsed.data.toLowerCase();
      updates.pseudoChangedAt = new Date();
    }
    if (body.language !== undefined) {
      if (!["fr", "en", "ar"].includes(body.language)) return apiError("Langue non supportée.");
      updates.language = body.language;
    }
    if (body.showPseudoInCohorts !== undefined) {
      updates.showPseudoInCohorts = body.showPseudoInCohorts;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }
    if (body.reminders !== undefined || body.cohortUpdates !== undefined) {
      await db
        .insert(notificationPrefs)
        .values({ userId: user.id, reminders: body.reminders ?? true, cohortUpdates: body.cohortUpdates ?? true })
        .onConflictDoUpdate({
          target: notificationPrefs.userId,
          set: {
            ...(body.reminders !== undefined ? { reminders: body.reminders } : {}),
            ...(body.cohortUpdates !== undefined ? { cohortUpdates: body.cohortUpdates } : {}),
          },
        });
    }
    if (!rateLimit(`me-patch:${user.id}`, 30, 60000)) return apiError("Trop de requêtes.", 429);
    return json({ ok: true });
  });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const { keepContributions } = await readJsonBody<{ keepContributions?: boolean }>(req);
    const db = await ensureDb();
    if (keepContributions) {
      const anon = await db.select().from(users).where(eq(users.pseudoLower, "ancien_membre")).limit(1);
      let anonId = anon[0]?.id;
      if (!anonId) {
        const created = await db
          .insert(users)
          .values({
            emailHash: `anon-${crypto.randomUUID()}`,
            emailEnc: "deleted",
            pseudo: "ancien_membre",
            pseudoLower: "ancien_membre",
            pseudoChangedAt: new Date(),
          })
          .returning();
        anonId = created[0].id;
      }
      await db.execute(`UPDATE applications SET user_id = '${anonId}' WHERE user_id = '${user.id}'`);
      await db.execute(`UPDATE flags SET reporter_id = '${anonId}' WHERE reporter_id = '${user.id}'`);
    } else {
      await db.execute(`DELETE FROM applications WHERE user_id = '${user.id}'`);
      await db.execute(`DELETE FROM flags WHERE reporter_id = '${user.id}'`);
    }
    await db.execute(`DELETE FROM notification_prefs WHERE user_id = '${user.id}'`);
    await db.execute(`DELETE FROM sessions WHERE user_id = '${user.id}'`);
    await db.execute(`DELETE FROM users WHERE id = '${user.id}'`);
    return json({ ok: true });
  });
}
