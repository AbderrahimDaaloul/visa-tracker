import { sql } from "drizzle-orm";
import { json, withApi } from "@/lib/api";
import { parseAdminEmails } from "@/lib/adminEmails";
import { checkDbConnected, rowsOf } from "@/lib/db/client";
import { emailProvider } from "@/lib/email";
import { ensureDb } from "@/lib/db/init";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(): Promise<NextResponse> {
  return withApi(async () => {
    await checkDbConnected();
    const db = await ensureDb();
    const counts = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM centers) AS centers,
        (SELECT count(*)::int FROM applications) AS applications,
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM audit_log) AS audit_entries
    `);
    return json({
      ok: true,
      database: process.env.DATABASE_URL ? "postgres" : "pglite",
      demoSeedEnabled: process.env.SEED_DEMO === "1",
      emailProvider: emailProvider(),
      adminEmailsConfigured: parseAdminEmails().length,
      counts: rowsOf(counts)[0],
      timestamp: new Date().toISOString(),
    });
  });
}
