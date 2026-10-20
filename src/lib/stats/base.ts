import { sql, type SQL } from "drizzle-orm";
import { ensureDb } from "@/lib/db/init";
import { rowsOf } from "@/lib/db/client";
import { MIN_SAMPLE_SIZE } from "../constants";

export type Filters = {
  centerId?: number;
  visaType?: string;
  intake?: string;
  from?: string;
  to?: string;
};

export function parseFilters(sp: URLSearchParams): Filters {
  const f: Filters = {};
  const centerId = sp.get("centerId");
  if (centerId && centerId !== "all") f.centerId = Number(centerId) || undefined;
  const visaType = sp.get("visaType");
  if (visaType && visaType !== "all") f.visaType = visaType;
  const intake = sp.get("intake");
  if (intake && intake !== "all") f.intake = intake;
  const from = sp.get("from");
  if (from) f.from = from;
  const to = sp.get("to");
  if (to) f.to = to;
  return f;
}

/** SQL fragment for active, non-banned, trusted, unflagged applications + global filters. */
export function baseSql(f: Filters): SQL {
  const parts: SQL[] = [
    sql`a.status = 'actif'`,
    sql`u.banned_at IS NULL`,
    sql`u.trust_score >= 20`,
    sql`NOT (
      EXISTS (
        SELECT 1 FROM flags fz
        WHERE fz.application_id = a.id
          AND fz.status = 'ouvert'
        GROUP BY fz.application_id
        HAVING count(*) >= 3
      )
    )`,
  ];
  if (f.centerId) parts.push(sql`a.center_id = ${f.centerId}`);
  if (f.visaType) parts.push(sql`a.visa_type = ${f.visaType}`);
  if (f.intake) parts.push(sql`a.intake = ${f.intake}`);
  if (f.from) parts.push(sql`coalesce(a.docs_sent_date, a.appointment_date) >= ${f.from}::date`);
  if (f.to) parts.push(sql`coalesce(a.docs_sent_date, a.appointment_date) <= ${f.to}::date`);
  return sql.join(parts, sql` AND `);
}

export type BaseRow = {
  centerId: number;
  visaType: string;
  intake: string;
  docsSent: string | null;
  appointment: string | null;
  bookedOn: string | null;
  slot: string | null;
  response: string | null;
  outcome: string;
  rejectionReason: string | null;
  createdAt: string;
};

export async function fetchBaseRows(f: Filters): Promise<BaseRow[]> {
  const db = await ensureDb();
  const q = await db.execute(sql`
    SELECT a.center_id,
           a.visa_type,
           a.intake,
           a.docs_sent_date,
           a.appointment_date,
           a.slot_booked_on,
           a.appointment_slot,
           a.response_date,
           a.outcome,
           a.rejection_reason,
           a.created_at::text AS created_at
    FROM applications a
    JOIN users u ON u.id = a.user_id
    WHERE ${baseSql(f)}
  `);
  const rows = rowsOf(q);
  return rows.map((r) => ({
    centerId: Number(r.center_id),
    visaType: String(r.visa_type),
    intake: String(r.intake),
    docsSent: (r.docs_sent_date as string | null) ?? null,
    appointment: (r.appointment_date as string | null) ?? null,
    bookedOn: (r.slot_booked_on as string | null) ?? null,
    slot: (r.appointment_slot as string | null) ?? null,
    response: (r.response_date as string | null) ?? null,
    outcome: String(r.outcome),
    rejectionReason: (r.rejection_reason as string | null) ?? null,
    createdAt: String(r.created_at),
  }));
}

export type StatEnvelope<T> =
  | { n: number; insufficientData: true; data: null; lastUpdated: string }
  | { n: number; insufficientData: false; data: T; lastUpdated: string };

export function envelope<T>(n: number, data: T | null): StatEnvelope<T> {
  const lastUpdated = new Date().toISOString();
  if (n < MIN_SAMPLE_SIZE || data === null) {
    return { n, insufficientData: true, data: null, lastUpdated };
  }
  return { n, insufficientData: false, data, lastUpdated };
}
