import { and, eq } from "drizzle-orm";
import { ensureDb } from "./db/init";
import { applications, centers } from "./db/schema";
import type { Application } from "./db/schema";

export async function getOwnedApplication(userId: string, applicationId: string) {
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getApplicationWithCenter(applicationId: string) {
  const db = await ensureDb();
  const rows = await db
    .select({ app: applications, center: centers })
    .from(applications)
    .innerJoin(centers, eq(centers.id, applications.centerId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  return rows[0] ?? null;
}

export type { Application };
