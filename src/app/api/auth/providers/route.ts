import { json } from "@/lib/api";
import { googleConfigured } from "@/lib/googleOAuth";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return json({ google: googleConfigured() });
}
