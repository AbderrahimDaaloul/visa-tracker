import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { FIXED_CENTER_NAME } from "../constants";

/** Reference data required by the app (not demo/mock data). */
export async function ensureReferenceData(): Promise<void> {
  const db = await getDb();
  // The community dashboard is scoped to Almaviva Tunisie only: migrate the
  // former VFS label in place so existing applications keep their center_id.
  await db.execute(sql`
    UPDATE centers SET name = ${FIXED_CENTER_NAME}
    WHERE name = 'VFS Global Tunis'
      AND NOT EXISTS (SELECT 1 FROM centers WHERE name = ${FIXED_CENTER_NAME})
  `);
  await db.execute(sql`
    INSERT INTO centers (country_code, name, visa_center_type, city) VALUES
      ('IT', ${FIXED_CENTER_NAME}, 'vfs', 'Tunis'),
      ('IT', 'Ambassade d''Italie à Tunis', 'embassy', 'Tunis'),
      ('IT', 'Autre centre', 'other', null)
    ON CONFLICT (name) DO NOTHING
  `);
}
