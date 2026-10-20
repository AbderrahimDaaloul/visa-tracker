import { sql } from "drizzle-orm";
import { getDb } from "./client";
import { applications, users } from "./schema";
import { sha256Hex } from "../crypto";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260901);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const weighted = <T>(arr: readonly [T, number][]): T => {
  const total = arr.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of arr) {
    if ((r -= w) < 0) return v;
  }
  return arr[arr.length - 1][0];
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

const PREFIX = ["etudiant", "etuda", "visa", "louz", "fennec", "carthage", "mira", "yass", "sami", "nour", "aziz", "henna", "sable", "jasmin", "olive", "corail"];
const SUFFIX = ["tunis", "sfax", "sousse", "bizerte", "gabes", "kef", "msaken", "hammamet", "gafsa", "megrine", "syracuse", "padova", "torino", "bologna", "le categorie", "padova"];
const LEVELS = ["master", "master", "master", "licence", "doctorat"] as const;
const VISA_TYPES = [["ms", 70], ["cours_langue", 25], ["autre", 5]] as const;
const WAIT_BASE: Record<number, { median: number; spread: number }> = {
  2: { median: 26, spread: 20 }, // VFS
  5: { median: 45, spread: 35 }, // Ambassade
  11: { median: 30, spread: 25 }, // autre
};
const FIELD = ["ingenierie", "medecine", "econ_gestion", "litteraire_cours", "ses", "econ_gestion", "ses", "ses"] as const;

export async function seedDemoData(): Promise<boolean> {
  const db = await getDb();

  await db.execute(sql`INSERT INTO meta (key, value) VALUES ('seeded_at', now()::text) ON CONFLICT (key) DO NOTHING`);
  const marker = await db.execute(sql`SELECT value FROM meta WHERE key = 'seed_version'`);
  const rows = (marker as unknown as { rows: { value: string }[] }).rows;
  if (rows.length > 0) return false;
  await db.execute(sql`INSERT INTO meta (key, value) VALUES ('seed_version', '1')`);

  await db.execute(sql`
    INSERT INTO centers (country_code, name, visa_center_type, city) VALUES
      ('IT', 'VFS Global Tunis', 'vfs', 'Tunis'),
      ('IT', 'Ambassade d''Italie à Tunis', 'embassy', 'Tunis'),
      ('IT', 'Autre centre', 'other', null)
      ON CONFLICT DO NOTHING
  `);

  const centersRows = await db.execute(sql`SELECT id FROM centers ORDER BY id`);
  const centerIds = (centersRows as unknown as { rows: { id: number }[] }).rows.map((r) => Number(r.id));

  const userCount = 640;
  const appCount = 560;
  const start = new Date("2025-02-01T00:00:00Z").getTime();
  const end = new Date("2026-10-01T00:00:00Z").getTime();
  const today = Date.now();

  const userValues: (typeof users.$inferInsert)[] = [];
  const usedPseudos = new Set<string>();
  for (let i = 0; i < userCount; i++) {
    let pseudo = "";
    for (;;) {
      pseudo = `${pick(PREFIX)}_${pick(SUFFIX)}${Math.floor(rand() * 90 + 10)}`;
      if (!usedPseudos.has(pseudo)) break;
    }
    usedPseudos.add(pseudo);
    const email = `demo-user-${i}@seed.local`;
    userValues.push({
      emailHash: sha256Hex(email),
      emailEnc: email,
      pseudo,
      pseudoLower: pseudo.toLowerCase(),
      role: "student",
      trustScore: Math.floor(rand() * 50 + 30),
      language: "fr",
      showPseudoInCohorts: rand() < 0.3,
      createdAt: new Date(start + rand() * (today - start)),
      lastLoginAt: new Date(today - rand() * 14 * 86400000),
    });
  }
  await db.insert(users).values(userValues);
  const userRows = await db.execute(sql`SELECT id FROM users ORDER BY email_hash LIMIT ${appCount}`);
  const userIds = (userRows as unknown as { rows: { id: string }[] }).rows.map((r) => String(r.id));

  const appValues: (typeof applications.$inferInsert)[] = [];
  for (let i = 0; i < appCount; i++) {
    const [vfsId, embassyId, otherId] = centerIds.length >= 3 ? centerIds : [1, 1, 1];
    const centerFallback = weighted<number>([[vfsId, 80], [embassyId, 15], [otherId, 5]]);
    const centerId = centerIds.includes(centerFallback) ? centerFallback : centerIds[0];
    const cfg = WAIT_BASE[centerId] ?? { median: 30, spread: 25 };
    const visaType = weighted(VISA_TYPES.map(([v, w]) => [v, w] as [string, number]));
    const created = new Date(start + rand() * (end - start));
    const monthOffset = rand() * 14; // intake shortly after creation
    const intakeDate = new Date(created.getTime() + monthOffset * 30 * 86400000);
    const intake = `${intakeDate.getUTCFullYear()}-${String(((Math.floor(intakeDate.getUTCMonth() / 3)) * 3 + 2) % 12 + 1).padStart(2, "0")}`;

    // appointment date: clustering on weekdays, more density in spring/summer
    let appt = new Date(created.getTime() + (10 + rand() * 90) * 86400000);
    let dow = appt.getUTCDay();
    if (dow === 0) {
      appt = addDays(appt, 1);
      dow = 1;
    }
    if (dow === 6) {
      appt = addDays(appt, 2);
      dow = 1;
    }

    const docsSent = new Date(appt.getTime() - Math.round(rand() * 30 - 8) * 86400000);
    if (docsSent.getTime() < start) docsSent.setTime(appt.getTime());
    if (docsSent.getTime() > today - 7 * 86400000) docsSent.setTime(today - Math.round(rand() * 5) * 86400000);

    const slotBookedOn = new Date(appt.getTime() - (2 + rand() * 45) * 86400000);

    // wait time: gamma-like from sum of uniforms, more spread for embassy
    let wait = 0;
    for (let j = 0; j < 3; j++) wait += rand();
    wait = Math.max(4, Math.round(cfg.median * (wait / 1.5)));
    if (rand() < 0.12) wait += Math.round(cfg.spread * 2.4); // outliers
    const response = new Date(docsSent.getTime() + wait * 86400000);

    const isRecent = created.getTime() > today - 75 * 86400000;
    const pendingChance = isRecent ? 0.55 : 0.08;
    let outcome: "accorde" | "refuse" | "en_attente" = "en_attente";
    let responseDate: string | null = null;
    let rejectionReason: string | null = null;
    if (rand() > pendingChance && response.getTime() <= today) {
      outcome = rand() < 0.72 ? "accorde" : "refuse";
      responseDate = iso(response);
      if (outcome === "refuse") rejectionReason = weighted([["documents_manquants", 35], ["preuve_financiere", 25], ["admission", 15], ["non_precise", 25]] as [string, number][]);
    }
    appValues.push({
      userId: userIds[i],
      centerId,
      visaType,
      intake,
      studyLevel: pick(LEVELS),
      fieldOfStudy: pick(FIELD),
      appointmentDate: appt.getTime() <= today ? iso(appt) : null,
      appointmentSlot: rand() < 0.5 ? "matin" : "apresmidi",
      slotBookedOn: iso(slotBookedOn),
      docsSentDate: iso(docsSent),
      docsSubmissionMode: weighted([["centre", 70], ["courier", 20], ["en_ligne", 10]] as [string, number][]),
      outcome,
      responseDate,
      rejectionReason,
      status: "actif",
      createdAt: created,
      updatedAt: created,
    });
  }
  await db.insert(applications).values(appValues);
  return true;
}
