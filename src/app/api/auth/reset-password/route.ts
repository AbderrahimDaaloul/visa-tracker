import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { destroyAllUserSessions } from "@/lib/auth";
import { hashPassword, passwordFingerprint, verifyPasswordResetToken } from "@/lib/crypto";
import { ensureDb } from "@/lib/db/init";
import { users } from "@/lib/db/schema";
import { resetPasswordSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = resetPasswordSchema.parse(await readJsonBody(req));
    if (!rateLimit(`reset.ip:${clientIp(req)}`, 20, 3600000)) {
      return apiError("Trop de tentatives. Réessayez dans une heure.", 429);
    }

    const parsed = verifyPasswordResetToken(body.token);
    if (!parsed) return apiError("Ce lien est invalide ou expiré. Demandez-en un nouveau.", 400);

    const db = await ensureDb();
    const rows = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
    const user = rows[0];
    if (!user || passwordFingerprint(user.passwordHash) !== parsed.fingerprint) {
      return apiError("Ce lien est invalide ou expiré. Demandez-en un nouveau.", 400);
    }

    await db.update(users).set({ passwordHash: hashPassword(body.password) }).where(eq(users.id, user.id));
    await destroyAllUserSessions(user.id);
    return json({ ok: true });
  });
}
