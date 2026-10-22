import { eq } from "drizzle-orm";
import { isBootstrapAdmin } from "./adminEmails";
import { encryptEmail, sha256Hex } from "./crypto";
import { ensureDb } from "./db/init";
import { notificationPrefs, users, type User } from "./db/schema";

export function roleForEmail(normalizedEmail: string): string {
  if (isBootstrapAdmin(normalizedEmail)) return "admin";
  if (process.env.NODE_ENV !== "production" && normalizedEmail === "admin@visatrack.local") return "admin";
  if (process.env.NODE_ENV !== "production" && normalizedEmail === "moderator@visatrack.local") return "moderator";
  return "student";
}

export async function findUserByEmail(normalizedEmail: string): Promise<User | null> {
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.emailHash, sha256Hex(normalizedEmail)))
    .limit(1);
  return rows[0] ?? null;
}

export async function isPseudoTaken(pseudo: string): Promise<boolean> {
  const db = await ensureDb();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.pseudoLower, pseudo.toLowerCase()))
    .limit(1);
  return Boolean(rows[0]);
}

export async function allocatePseudo(preferred: string): Promise<string> {
  const raw = preferred
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  const base = raw.length >= 3 ? raw : "etudiant";
  let candidate = base;
  let suffixNumber = 1;
  while (await isPseudoTaken(candidate)) {
    const suffix = `_${suffixNumber++}`;
    candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
  }
  return candidate;
}

export async function createAccount(input: {
  normalizedEmail: string;
  pseudo: string;
  passwordHash: string | null;
  authProvider: "password" | "google";
  emailVerifiedAt: Date | null;
}): Promise<User> {
  const db = await ensureDb();
  const inserted = await db
    .insert(users)
    .values({
      emailHash: sha256Hex(input.normalizedEmail),
      emailEnc: encryptEmail(input.normalizedEmail),
      pseudo: input.pseudo,
      pseudoLower: input.pseudo.toLowerCase(),
      pseudoChangedAt: new Date(),
      passwordHash: input.passwordHash,
      authProvider: input.authProvider,
      emailVerifiedAt: input.emailVerifiedAt,
      role: roleForEmail(input.normalizedEmail),
    })
    .returning();
  const user = inserted[0];
  await db.insert(notificationPrefs).values({ userId: user.id }).onConflictDoNothing();
  return user;
}

export async function markEmailVerified(userId: string): Promise<User | null> {
  const db = await ensureDb();
  const updated = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated[0] ?? null;
}

export async function promoteBootstrapAdmin(user: User, normalizedEmail: string): Promise<User> {
  if (!isBootstrapAdmin(normalizedEmail) || user.role === "admin") return user;
  const db = await ensureDb();
  const promoted = await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id)).returning();
  return promoted[0] ?? { ...user, role: "admin" };
}

export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "23505";
}
