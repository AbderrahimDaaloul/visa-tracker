import { sql } from "drizzle-orm";
import { getDb } from "./client";

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS centers (
    id serial PRIMARY KEY,
    country_code text NOT NULL DEFAULT 'IT',
    name text NOT NULL,
    visa_center_type text NOT NULL DEFAULT 'other',
    city text,
    active boolean NOT NULL DEFAULT true
  )`,
  `CREATE INDEX IF NOT EXISTS centers_country_idx ON centers (country_code, active)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS centers_name_unique ON centers (name)`,
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash text NOT NULL UNIQUE,
    email_enc text NOT NULL,
    pseudo text NOT NULL,
    pseudo_lower text NOT NULL UNIQUE,
    pseudo_changed_at timestamptz,
    password_hash text,
    auth_provider text NOT NULL DEFAULT 'password',
    email_verified_at timestamptz DEFAULT now(),
    role text NOT NULL DEFAULT 'student',
    trust_score integer NOT NULL DEFAULT 50,
    language text NOT NULL DEFAULT 'fr',
    show_pseudo_in_cohorts boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    banned_at timestamptz
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'password'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz DEFAULT now()`,
  `ALTER TABLE users ALTER COLUMN show_pseudo_in_cohorts SET DEFAULT true`,
  `CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token text NOT NULL UNIQUE,
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    center_id integer NOT NULL REFERENCES centers(id),
    visa_type text NOT NULL DEFAULT 'etudiant_d',
    intake text NOT NULL,
    study_level text,
    field_of_study text,
    appointment_date date,
    appointment_slot text,
    slot_booked_on date,
    docs_sent_date date,
    docs_submission_mode text,
    outcome text NOT NULL DEFAULT 'en_attente',
    response_date date,
    rejection_reason text,
    status text NOT NULL DEFAULT 'actif',
    flagged_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (response_date IS NULL OR docs_sent_date IS NULL OR response_date >= docs_sent_date),
    CHECK (outcome = 'en_attente' OR response_date IS NOT NULL)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS applications_unique_active
     ON applications (user_id, center_id, intake) WHERE status = 'actif'`,
  `CREATE INDEX IF NOT EXISTS apps_center_docs_idx ON applications (center_id, docs_sent_date) WHERE status = 'actif'`,
  `CREATE INDEX IF NOT EXISTS apps_center_appt_idx ON applications (center_id, appointment_date) WHERE status = 'actif'`,
  `CREATE INDEX IF NOT EXISTS apps_center_resp_idx ON applications (center_id, response_date) WHERE status = 'actif'`,
  `CREATE INDEX IF NOT EXISTS apps_user_idx ON applications (user_id) WHERE status = 'actif'`,
  `CREATE TABLE IF NOT EXISTS events (
    id serial PRIMARY KEY,
    application_id uuid NOT NULL,
    type text NOT NULL,
    payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS events_app_idx ON events (application_id)`,
  `CREATE TABLE IF NOT EXISTS flags (
    id serial PRIMARY KEY,
    application_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'ouvert',
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid
  )`,
  `CREATE INDEX IF NOT EXISTS flags_app_idx ON flags (application_id)`,
  `CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id uuid PRIMARY KEY,
    reminders boolean NOT NULL DEFAULT true,
    cohort_updates boolean NOT NULL DEFAULT true
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id serial PRIMARY KEY,
    actor_id uuid,
    actor_role text NOT NULL,
    action text NOT NULL,
    detail jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS meta (
    key text PRIMARY KEY,
    value text,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
];

export async function ensureSchema(): Promise<void> {
  const db = await getDb();
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}
