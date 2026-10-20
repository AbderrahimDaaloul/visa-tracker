import { json, withApi } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  return withApi(async () => {
    await clearSessionCookie();
    return json({ ok: true });
  });
}
