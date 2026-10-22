import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { findUserByEmail } from "@/lib/accounts";
import { getSessionUser } from "@/lib/auth";
import { createPasswordResetToken, passwordFingerprint } from "@/lib/crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { resolvePasswordResetEmail } from "@/lib/passwordReset";
import { forgotPasswordSchema } from "@/lib/validation";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const sessionUser = await getSessionUser();
    const body = await readJsonBody<{ email?: string }>(req);
    const submittedEmail = sessionUser ? "" : forgotPasswordSchema.parse(body).email;
    const normalized = resolvePasswordResetEmail(sessionUser?.email, submittedEmail);
    const attemptKey = sessionUser ? `forgot.user:${sessionUser.id}` : `forgot.email:${normalized}`;
    if (
      !rateLimit(`forgot.ip:${clientIp(req)}`, 20, 3600000) ||
      !rateLimit(attemptKey, 5, 3600000)
    ) {
      return apiError("Trop de demandes. Réessayez dans une heure.", 429);
    }

    const user = await findUserByEmail(normalized);
    let devResetUrl: string | null = null;
    if (user && !user.bannedAt) {
      const token = createPasswordResetToken(user.id, passwordFingerprint(user.passwordHash));
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      const result = await sendPasswordResetEmail(normalized, link);
      devResetUrl = result.devUrl ?? null;
    }

    // Same response whether the account exists or not, to avoid email enumeration.
    return json({ ok: true, devResetUrl });
  });
}
