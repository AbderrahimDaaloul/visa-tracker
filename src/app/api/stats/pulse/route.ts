import { sql } from "drizzle-orm";
import { json, withApi } from "@/lib/api";
import { rowsOf } from "@/lib/db/client";
import { MIN_SAMPLE_SIZE } from "@/lib/constants";
import { fetchBaseRows, parseFilters, envelope, baseSql } from "@/lib/stats/base";
import { currentWaitOf, medianW, sortAsc } from "@/lib/stats/compute";
import type { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  return withApi(async () => {
    const f = parseFilters(new URL(req.url).searchParams);
    const rows = await fetchBaseRows(f);
    const { ensureDb } = await import("@/lib/db/init");
    const db = await ensureDb();
    const counts = await db.execute(sql`
      SELECT
        count(DISTINCT a.user_id) FILTER (WHERE a.updated_at >= now() - interval '30 days') AS active_contributors,
        count(*) FILTER (WHERE a.created_at >= now() - interval '7 days') AS new_this_week
      FROM applications a
      JOIN users u ON u.id = a.user_id
      WHERE ${baseSql(f)}
    `);
    const c = rowsOf<{ active_contributors: number; new_this_week: number }>(counts)[0];
    const currentWaitValues = rows
      .filter((r) => !r.response)
      .map((r) => currentWaitOf(r))
      .filter((w): w is { days: number; basis: "documents" } => !!w && w.basis === "documents")
      .map((w) => w.days);
    const respondedLast90 = rows.filter((r) => r.response && r.response >= new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
    return json(
      envelope(rows.length, {
        activeContributors: Number(c?.active_contributors ?? 0),
        newDataThisWeek: Number(c?.new_this_week ?? 0),
        currentMedianWait: currentWaitValues.length >= MIN_SAMPLE_SIZE ? Math.round(medianW(sortAsc(currentWaitValues))) : null,
        currentApprovalRate: respondedLast90.length
          ? Math.round((respondedLast90.filter((r) => r.outcome === "accorde").length / respondedLast90.length) * 100)
          : null,
        currentApprovalRateN: respondedLast90.length,
        pendingCases: rows.filter((r) => !r.response).length,
      })
    );
  });
}
