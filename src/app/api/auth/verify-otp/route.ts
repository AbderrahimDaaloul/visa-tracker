import { apiError, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { hmacHex, normalizeEmail, sha256Hex } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { ensureDb } from "@/lib/db/init";
import { notificationPrefs, otpCodes, users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { verifyOtpSchema } from "@/lib/validation";
import { encryptEmail } from "@/lib/crypto";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = verifyOtpSchema.parse(await readJsonBody(req));
    if (!rateLimit(`verify:${normalizeEmail(body.email).toLowerCase()}`, 10, 3600000)) {
      return apiError("Trop de tentatives. Réessayez dans une heure.", 429);
    }
    const normalized = normalizeEmail(body.email);
    const hash = sha256Hex(normalized);
    const db = await ensureDb();

    const otpRows = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.emailHash, hash), isNull(otpCodes.usedAt)))
      .orderBy(otpCodes.id)
      .limit(20);
    const now = new Date();
    const valid = otpRows.reverse().find((o) => o.expiresAt > now && o.codeHash === hmacHex(body.code));
    if (!valid) return apiError("Code invalide ou expiré. Demandez un nouveau code.", 400);
    await db.update(otpCodes).set({ usedAt: now }).where(eq(otpCodes.id, valid.id));

    const existing = await db.select().from(users).where(eq(users.emailHash, hash)).limit(1);
    let user = existing[0];
    if (!user) {
      const pseudo = body.pseudo;
      if (!pseudo) return json({ needsPseudo: true }, 200);
      const taken = await db.select().from(users).where(eq(users.pseudoLower, pseudo.toLowerCase())).limit(1);
      if (taken[0]) return apiError("Ce pseudo est déjà pris.", 409);
      const role =
        process.env.NODE_ENV !== "production" && normalized === "admin@visatrack.local"
          ? "admin"
          : process.env.NODE_ENV !== "production" && normalized === "moderator@visatrack.local"
            ? "moderator"
            : "student";
      const inserted = await db
        .insert(users)
        .values({
          emailHash: hash,
          emailEnc: encryptEmail(normalized),
          pseudo,
          pseudoLower: pseudo.toLowerCase(),
          pseudoChangedAt: new Date(),
          role,
        })
        .returning();
      user = inserted[0];
      await db.insert(notificationPrefs).values({ userId: user.id }).onConflictDoNothing();
    }
    if (user.bannedAt) return apiError("Ce compte est suspendu.", 403);
    await createSession(user.id);
    return json({ ok: true, user: { id: user.id, pseudo: user.pseudo, role: user.role } });
  });
}
