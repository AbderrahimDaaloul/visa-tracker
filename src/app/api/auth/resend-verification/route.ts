import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { findUserByEmail } from "@/lib/accounts";
import { normalizeEmail } from "@/lib/crypto";
import { emailProvider } from "@/lib/email";
import { resendVerificationSchema } from "@/lib/validation";
import { sendAccountVerificationEmail } from "@/lib/verification";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = resendVerificationSchema.parse(await readJsonBody(req));
    const normalized = normalizeEmail(body.email);
    if (
      !rateLimit(`resend-verify.ip:${clientIp(req)}`, 20, 3600000) ||
      !rateLimit(`resend-verify.email:${normalized}`, 5, 3600000)
    ) {
      return apiError("Trop de demandes. Réessayez dans une heure.", 429);
    }
    if (!emailProvider() && process.env.NODE_ENV === "production") {
      return apiError("Le service email n'est pas configuré. Réessayez plus tard.", 503);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const user = await findUserByEmail(normalized);
    let devUrl: string | null = null;
    if (user && !user.bannedAt && !user.emailVerifiedAt) {
      const result = await sendAccountVerificationEmail({
        email: normalized,
        userId: user.id,
        emailHash: user.emailHash,
        origin,
      });
      devUrl = result.devUrl ?? null;
    }

    // Same response whether the account exists or is already verified.
    return json({ ok: true, devUrl });
  });
}
