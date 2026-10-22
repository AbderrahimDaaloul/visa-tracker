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
    if (!user) return json({ user: null, prefs: null });
    const db = await ensureDb();
    const prefs = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, user.id)).limit(1);
    return json({
      user,
      prefs: prefs[0] ?? { userId: user.id, reminders: true, cohortUpdates: true },
    });
  });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody<{
      pseudo?: string;
      language?: string;
      showPseudoInCohorts?: boolean;
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
    if (!rateLimit(`me-patch:${user.id}`, 30, 60000)) return apiError("Trop de requêtes.", 429);
    return json({ ok: true });
  });
}

export async function DELETE(): Promise<NextResponse> {
  return apiError("La suppression de compte est désactivée. Contactez l'administrateur.", 403);
}
