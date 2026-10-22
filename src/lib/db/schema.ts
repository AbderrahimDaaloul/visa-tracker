import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const centers = pgTable("centers", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull().default("IT"),
  name: text("name").notNull(),
  visaCenterType: text("visa_center_type").notNull().default("other"), // vfs | embassy | other
  city: text("city"),
  active: boolean("active").notNull().default(true),
});

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  emailHash: text("email_hash").notNull().unique(),
  emailEnc: text("email_enc").notNull(),
  pseudo: text("pseudo").notNull(),
  pseudoLower: text("pseudo_lower").notNull().unique(),
  pseudoChangedAt: timestamp("pseudo_changed_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider").notNull().default("password"), // password | google
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }).defaultNow(),
  role: text("role").notNull().default("student"), // student | moderator | admin
  trustScore: integer("trust_score").notNull().default(50),
  language: text("language").notNull().default("fr"),
  showPseudoInCohorts: boolean("show_pseudo_in_cohorts").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
});

export const sessions = pgTable("sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const applications = pgTable("applications", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  centerId: integer("center_id").notNull(),
  visaType: text("visa_type").notNull().default("etudiant_d"), // etudiant_d | cours_langue | autre
  intake: text("intake").notNull(), // e.g. "2026-09"
  studyLevel: text("study_level"), // licence | master
  fieldOfStudy: text("field_of_study"),
  appointmentDate: date("appointment_date"),
  appointmentSlot: text("appointment_slot"), // matin | apresmidi
  slotBookedOn: date("slot_booked_on"),
  docsSentDate: date("docs_sent_date"),
  docsSubmissionMode: text("docs_submission_mode"), // centre | courier | en_ligne
  outcome: text("outcome").notNull().default("en_attente"), // en_attente | accorde | refuse
  responseDate: date("response_date"),
  rejectionReason: text("rejection_reason"), // texte libre (max 300)
  status: text("status").notNull().default("actif"), // actif | cache | supprime
  flaggedAt: timestamp("flagged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  applicationId: uuid("application_id").notNull(),
  type: text("type").notNull(), // rendez_vous | envoi_dossiers | reponse | edit | delete
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flags = pgTable("flags", {
  id: serial("id").primaryKey(),
  applicationId: uuid("application_id").notNull(),
  reporterId: uuid("reporter_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("ouvert"), // ouvert | rejete | confirmee
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by"),
});

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id").primaryKey(),
  reminders: boolean("reminders").notNull().default(true),
  cohortUpdates: boolean("cohort_updates").notNull().default(true),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: uuid("actor_id"),
  actorRole: text("actor_role").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meta = pgTable("meta", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Center = typeof centers.$inferSelect;
export type User = typeof users.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Flag = typeof flags.$inferSelect;

export const schema = { centers, users, sessions, applications, events, flags, notificationPrefs, auditLog, meta };
