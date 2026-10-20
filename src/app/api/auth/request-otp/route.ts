import { apiError, clientIp, json, rateLimit, readJsonBody, withApi } from "@/lib/api";
import { generateOtp, hmacHex, normalizeEmail, sha256Hex } from "@/lib/crypto";
import { ensureDb } from "@/lib/db/init";
import { sendOtpEmail } from "@/lib/email";
import { DISPOSABLE_DOMAINS } from "@/lib/constants";
import { requestOtpSchema } from "@/lib/validation";
import { otpCodes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const body = requestOtpSchema.parse(await readJsonBody(req));
    const normalized = normalizeEmail(body.email);
    const domain = normalized.split("@")[1] ?? "";
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return apiError("Les emails jetables sont refusés. Utilisez un email académique, Gmail ou Outlook.", 400);
    }
    if (!rateLimit(`otp.ip:${clientIp(req)}`, 30, 3600000) || !rateLimit(`otp.email:${normalized.toLowerCase()}`, 5, 3600000)) {
      return apiError("Trop de demandes. Réessayez dans une heure.", 429);
    }
    const hash = sha256Hex(normalized);
    const db = await ensureDb();
    await db.select().from(users).where(eq(users.emailHash, hash)).limit(1);
    const code = generateOtp();
    const sent = await sendOtpEmail(normalized, code);
    await db.insert(otpCodes).values({
      emailHash: hash,
      codeHash: hmacHex(code),
      codePlain: sent.devCode ? code : null,
      expiresAt: new Date(Date.now() + 15 * 60000),
    });
    return json({ ok: true, devCode: sent.devCode ?? null });
  });
}
