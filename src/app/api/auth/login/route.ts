import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { findUserByEmail, promoteBootstrapAdmin } from "@/lib/accounts";
import { createSession } from "@/lib/auth";
import { normalizeEmail, verifyPassword } from "@/lib/crypto";
import { loginSchema } from "@/lib/validation";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = loginSchema.parse(await readJsonBody(req));
    const normalized = normalizeEmail(body.email);
    if (
      !rateLimit(`login.ip:${clientIp(req)}`, 30, 15 * 60000) ||
      !rateLimit(`login.email:${normalized}`, 10, 15 * 60000)
    ) {
      return apiError("Trop de tentatives. Réessayez dans quelques minutes.", 429);
    }

    const user = await findUserByEmail(normalized);
    const valid = verifyPassword(body.password, user?.passwordHash ?? null);
    if (!user || !valid) {
      return apiError(
        "Email ou mot de passe incorrect. Si vous aviez un compte sans mot de passe, utilisez « Mot de passe oublié ».",
        401
      );
    }
    if (user.bannedAt) return apiError("Ce compte est suspendu.", 403);
    if (!user.emailVerifiedAt) {
      return apiError(
        "Veuillez vérifier votre adresse email avant de vous connecter.",
        403,
        { code: "email_not_verified" }
      );
    }

    const account = await promoteBootstrapAdmin(user, normalized);
    await createSession(account.id);
    return json({ ok: true, user: { id: account.id, pseudo: account.pseudo, role: account.role } });
  });
}
