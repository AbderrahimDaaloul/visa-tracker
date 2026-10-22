import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { schema } from "./schema";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AppDb = PgDatabase<any, any, any>;

const g = globalThis as unknown as { db?: AppDb; dbInitPromise?: Promise<AppDb> };

export async function getDb(): Promise<AppDb> {
  if (g.db) return g.db;
  if (!g.dbInitPromise) {
    g.dbInitPromise = createDb()
      .then((db) => {
        g.db = db;
        return db;
      })
      .catch((error) => {
        g.dbInitPromise = undefined;
        throw error;
      });
  }
  return g.dbInitPromise;
}

async function createDb(): Promise<AppDb> {
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL;
    const postgres = (await import("postgres")).default;
    const forceSsl =
      /supabase\.(co|com)/i.test(url) && !/[?&]sslmode=/i.test(url);
    const pg = postgres(url, {
      prepare: false,
      max: 10,
      connect_timeout: 10,
      idle_timeout: 30,
      ...(forceSsl ? { ssl: "require" as const } : {}),
    });
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return drizzle(pg, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR ?? ".data/pglite";
  const client = await new PGlite(dataDir);
  const { drizzle } = await import("drizzle-orm/pglite");
  return drizzle(client, { schema });
}

export async function checkDbConnected(): Promise<boolean> {
  const db = await getDb();
  await db.execute(sql`SELECT 1`);
  return true;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowsOf<T = any>(q: any): T[] {
  if (Array.isArray(q)) return q as T[];
  if (q && Array.isArray(q.rows)) return q.rows as T[];
  return [];
}
