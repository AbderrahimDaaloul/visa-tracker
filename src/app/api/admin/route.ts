import { NextResponse } from "next/server";
import { json, withApi } from "@/lib/api";
import { requireRole } from "@/lib/adminGuard";
import { rowsOf } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export function GET(): Promise<NextResponse> {
  return withApi(async () => {
    const user = await requireRole(["admin", "moderator"]);
    const { ensureDb } = await import("@/lib/db/init");
    const db = await ensureDb();
    const users = await db.execute(`
      SELECT u.id, u.pseudo, u.role, u.trust_score, u.created_at::text AS created_at,
             u.banned_at, u.last_login_at::text AS last_login,
             count(a.id) FILTER (WHERE a.status = 'actif') AS active_apps
      FROM users u LEFT JOIN applications a ON a.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC
    `);
    const entries = await db.execute(`
      SELECT a.id, a.outcome, a.intake, a.visa_type, a.status, a.created_at::text AS created_at,
             u.pseudo, c.name AS center,
             (SELECT count(*)::int FROM flags f WHERE f.application_id = a.id AND f.status = 'ouvert') AS open_flags
      FROM applications a
      JOIN users u ON u.id = a.user_id
      LEFT JOIN centers c ON c.id = a.center_id
      ORDER BY a.created_at DESC
      LIMIT 200
    `);
    const openFlags = await db.execute(`
      SELECT f.id, f.reason, f.created_at::text AS created_at, f.status,
             a.id AS application_id, u.pseudo AS reporter
      FROM flags f
      JOIN applications a ON a.id = f.application_id
      JOIN users u ON u.id = f.reporter_id
      WHERE f.status = 'ouvert'
      ORDER BY f.created_at DESC
    `);
    const stats = await db.execute(`
      SELECT
        (SELECT count(*)::int FROM users) AS users_total,
        (SELECT count(*)::int FROM users WHERE banned_at IS NOT NULL) AS users_banned,
        (SELECT count(*)::int FROM applications WHERE status = 'actif') AS apps_active,
        (SELECT count(*)::int FROM applications WHERE status = 'cache') AS apps_hidden,
        (SELECT count(*)::int FROM flags WHERE status = 'ouvert') AS flags_open
    `);
    const audit = await db.execute(`
      SELECT l.id, l.actor_role, l.action, l.detail, l.created_at::text AS created_at,
             u.pseudo AS actor
      FROM audit_log l
      LEFT JOIN users u ON u.id = l.actor_id
      ORDER BY l.created_at DESC
      LIMIT 50
    `);
    return json({
      stats: rowsOf(stats)[0],
      users: rowsOf(users),
      entries: rowsOf(entries),
      openFlags: rowsOf(openFlags),
      audit: rowsOf(audit),
      viewer: { role: user.role },
    });
  });
}
