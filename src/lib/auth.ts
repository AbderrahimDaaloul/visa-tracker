import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { generateToken, decryptEmail, sha256Hex } from "@/lib/crypto";
import { ensureDb } from "./db/init";
import { notificationPrefs, sessions, users } from "./db/schema";

const SESSION_COOKIE = "vtt_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  pseudo: string;
  role: string;
  language: string;
  showPseudoInCohorts: boolean;
  trustScore: number;
  createdAt: Date;
  pseudoChangedAt: Date | null;
  email: string;
};

export async function createSession(userId: string): Promise<string> {
  const db = await ensureDb();
  const token = sha256Hex(`${userId}|${generateToken()}|${crypto.randomUUID()}`);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  await db.insert(notificationPrefs).values({ userId }).onConflictDoNothing();
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return token;
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  const db = await ensureDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (rows.length === 0) return null;
  const userRows = await db.select().from(users).where(eq(users.id, rows[0].userId)).limit(1);
  const u = userRows[0];
  if (!u || u.bannedAt || !u.emailVerifiedAt) return null;
  return {
    id: u.id,
    pseudo: u.pseudo,
    role: u.role,
    language: u.language,
    showPseudoInCohorts: u.showPseudoInCohorts,
    trustScore: u.trustScore,
    createdAt: u.createdAt,
    pseudoChangedAt: u.pseudoChangedAt,
    email: decryptEmail(u.emailEnc),
  };
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await ensureDb();
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.set(SESSION_COOKIE, "", { expires: new Date(0), path: "/", httpOnly: true });
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}
