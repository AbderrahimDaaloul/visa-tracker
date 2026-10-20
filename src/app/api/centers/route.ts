import { json, withApi } from "@/lib/api";
import { ensureDb } from "@/lib/db/init";
import { centers } from "@/lib/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return withApi(async () => {
    const db = await ensureDb();
    const rows = await db.select().from(centers).where(inArray(centers.active, [true])).orderBy(asc(centers.id));
    void eq;
    return json({ centers: rows });
  });
}
