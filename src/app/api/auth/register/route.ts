import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { createAccount, findUserByEmail, isPseudoTaken, isUniqueViolation } from "@/lib/accounts";
import { DISPOSABLE_DOMAINS } from "@/lib/constants";
import { hashPassword, normalizeEmail } from "@/lib/crypto";
import { emailProvider } from "@/lib/email";
import { emailDomain, isEmailDomainDeliverable } from "@/lib/emailDomain";
import { registerSchema } from "@/lib/validation";
import { sendAccountVerificationEmail } from "@/lib/verification";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = registerSchema.parse(await readJsonBody(req));
    const normalized = normalizeEmail(body.email);
    const domain = emailDomain(normalized);
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return apiError("Les emails jetables sont refusés. Utilisez un email académique, Gmail ou Outlook.", 400);
    }
    if (!rateLimit(`register.ip:${clientIp(req)}`, 20, 3600000) || !rateLimit(`register.email:${normalized}`, 5, 3600000)) {
      return apiError("Trop de tentatives. Réessayez dans une heure.", 429);
    }
    if (!(await isEmailDomainDeliverable(domain))) {
      return apiError("Cette adresse email n'existe pas ou son domaine ne reçoit pas d'emails. Vérifiez-la.", 400);
    }
    if (!emailProvider() && process.env.NODE_ENV === "production") {
      return apiError("Le service email n'est pas configuré. Impossible de créer un compte pour le moment.", 503);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const existing = await findUserByEmail(normalized);
    if (existing) {
      if (existing.bannedAt) return apiError("Ce compte est suspendu.", 403);
      if (existing.emailVerifiedAt) return apiError("Un compte existe déjà avec cet email.", 409);
      const result = await sendAccountVerificationEmail({
        email: normalized,
        userId: existing.id,
        emailHash: existing.emailHash,
        origin,
      });
      return json({ ok: true, verificationRequired: true, emailSent: result.sent, devUrl: result.devUrl ?? null });
    }
    if (await isPseudoTaken(body.pseudo)) return apiError("Ce pseudo est déjà pris.", 409);

    try {
      const user = await createAccount({
        normalizedEmail: normalized,
        pseudo: body.pseudo,
        passwordHash: hashPassword(body.password),
        authProvider: "password",
        emailVerifiedAt: null,
      });
      const result = await sendAccountVerificationEmail({
        email: normalized,
        userId: user.id,
        emailHash: user.emailHash,
        origin,
      });
      return json({ ok: true, verificationRequired: true, emailSent: result.sent, devUrl: result.devUrl ?? null });
    } catch (error) {
      if (isUniqueViolation(error)) return apiError("Cet email ou ce pseudo est déjà utilisé.", 409);
      throw error;
    }
  });
}
