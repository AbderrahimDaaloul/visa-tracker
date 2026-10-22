import {
  allocatePseudo,
  createAccount,
  findUserByEmail,
  isUniqueViolation,
  markEmailVerified,
  promoteBootstrapAdmin,
} from "@/lib/accounts";
import { createSession } from "@/lib/auth";
import { DISPOSABLE_DOMAINS } from "@/lib/constants";
import { normalizeEmail } from "@/lib/crypto";
import { exchangeGoogleCode } from "@/lib/googleOAuth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "vtt_oauth_state";

function redirectTo(origin: string, path: string): NextResponse {
  const res = NextResponse.redirect(new URL(path, origin));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestUrl = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;

  try {
    if (requestUrl.searchParams.get("error")) {
      return redirectTo(origin, "/login?error=oauth_denied");
    }

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const jar = await cookies();
    const expectedState = jar.get(STATE_COOKIE)?.value;
    if (!code || !state || !expectedState || state !== expectedState) {
      return redirectTo(origin, "/login?error=oauth_state");
    }

    const profile = await exchangeGoogleCode(code, `${origin}/api/auth/google/callback`);
    if (!profile) return redirectTo(origin, "/login?error=oauth_failed");
    if (!profile.emailVerified) return redirectTo(origin, "/login?error=oauth_email");

    const normalized = normalizeEmail(profile.email);
    const domain = normalized.split("@")[1] ?? "";
    if (DISPOSABLE_DOMAINS.has(domain)) return redirectTo(origin, "/login?error=disposable");

    let user = await findUserByEmail(normalized);
    if (user?.bannedAt) return redirectTo(origin, "/login?error=banned");

    if (!user) {
      try {
        const pseudo = await allocatePseudo(profile.name || normalized.split("@")[0]);
        user = await createAccount({
          normalizedEmail: normalized,
          pseudo,
          passwordHash: null,
          authProvider: "google",
          emailVerifiedAt: new Date(),
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        user = await findUserByEmail(normalized);
        if (!user) return redirectTo(origin, "/login?error=oauth_failed");
      }
    }

    if (!user.emailVerifiedAt) {
      user = (await markEmailVerified(user.id)) ?? user;
    }

    user = await promoteBootstrapAdmin(user, normalized);
    await createSession(user.id);
    return redirectTo(origin, "/journey");
  } catch (error) {
    console.error("[oauth] erreur de connexion Google", error);
    return redirectTo(origin, "/login?error=oauth_failed");
  }
}
