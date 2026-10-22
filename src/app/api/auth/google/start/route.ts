import { googleAuthUrl, googleConfigured } from "@/lib/googleOAuth";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", origin));
  }

  const state = randomUUID();
  const res = NextResponse.redirect(googleAuthUrl(origin, state));
  res.cookies.set("vtt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
