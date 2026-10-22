import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "./client";
import { ensureSchema } from "./ddl";
import { ensureReferenceData } from "./reference";
import { seedDemoData } from "./seed";

const g = globalThis as unknown as { appInitPromise?: Promise<void> };

export async function ensureAppInit(): Promise<void> {
  if (!g.appInitPromise) {
    g.appInitPromise = (async () => {
      await ensureSchema();
      await ensureReferenceData();
      await migrateShowPseudoDefault();
      // Demo data is strictly opt-in: never insert mock rows by accident.
      if (process.env.SEED_DEMO === "1") {
        await seedDemoData();
      }
    })().catch((e) => {
      g.appInitPromise = undefined;
      throw e;
    });
  }
  await g.appInitPromise;
}

/** One-time migration: pseudo visibility is now on by default. */
async function migrateShowPseudoDefault(): Promise<void> {
  const db = await getDb();
  const marker = await db.execute(sql`SELECT value FROM meta WHERE key = 'migration_show_pseudo_default'`);
  const rows = rowsOf<{ value: string }>(marker);
  if (rows.length > 0) return;
  await db.execute(sql`UPDATE users SET show_pseudo_in_cohorts = true`);
  await db.execute(sql`
    INSERT INTO meta (key, value) VALUES ('migration_show_pseudo_default', '1')
    ON CONFLICT (key) DO UPDATE SET value = '1'
  `);
}

export async function ensureDb() {
  await ensureAppInit();
  return getDb();
}

export async function wipeAll(): Promise<void> {
  const db = await ensureDb();
    const tables = ["events", "flags", "notification_prefs", "sessions", "applications", "users", "centers", "audit_log", "meta"];
  for (const t of tables) {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(t)} CASCADE`);
  }
}
