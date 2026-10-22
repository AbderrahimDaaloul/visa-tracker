import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { verifyEmailVerificationToken } from "@/lib/crypto";
import { ensureDb } from "@/lib/db/init";
import { users } from "@/lib/db/schema";
import { verifyEmailSchema } from "@/lib/validation";
import { eq } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = verifyEmailSchema.parse(await readJsonBody(req));
    if (!rateLimit(`verify-email.ip:${clientIp(req)}`, 30, 3600000)) {
      return apiError("Trop de tentatives. Réessayez dans une heure.", 429);
    }

    const parsed = verifyEmailVerificationToken(body.token);
    if (!parsed) return apiError("Ce lien de vérification est invalide ou expiré.", 400);

    const db = await ensureDb();
    const rows = await db.select().from(users).where(eq(users.id, parsed.userId)).limit(1);
    const user = rows[0];
    if (!user || user.emailHash !== parsed.emailHash) {
      return apiError("Ce lien de vérification est invalide ou expiré.", 400);
    }

    if (!user.emailVerifiedAt) {
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    }
    return json({ ok: true });
  });
}
