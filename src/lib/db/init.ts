import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { ensureSchema } from "./ddl";
import { seedDemoData } from "./seed";

const g = globalThis as unknown as { appInitPromise?: Promise<void> };

export async function ensureAppInit(): Promise<void> {
  if (!g.appInitPromise) {
    g.appInitPromise = (async () => {
      await ensureSchema();
      if (process.env.SEED_DEMO !== "0") {
        await seedDemoData();
      }
    })().catch((e) => {
      g.appInitPromise = undefined;
      throw e;
    });
  }
  await g.appInitPromise;
}

export async function ensureDb() {
  await ensureAppInit();
  return getDb();
}

export async function wipeAll(): Promise<void> {
  const db = await ensureDb();
  const tables = ["events", "flags", "notification_prefs", "sessions", "otp_codes", "applications", "users", "centers", "meta"];
  for (const t of tables) {
    await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(t)} CASCADE`);
  }
}
