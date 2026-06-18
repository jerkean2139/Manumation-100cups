import { getPool } from "./index.js";
import { env } from "../env.js";

/**
 * Idempotent schema bootstrap.
 *
 * Runs on boot when a database is connected, so a fresh Railway deploy comes up
 * with the schema in place — no manual migration step. Every statement is
 * `IF NOT EXISTS`, so it's safe to run on every start. (For larger teams this
 * can later be swapped for versioned drizzle-kit migrations; for a stable v1
 * schema, an idempotent bootstrap is the most reliable path to a green deploy.)
 *
 * Mirrors `schema.ts` — keep the two in sync.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_location_id text NOT NULL UNIQUE,
  name text,
  ghl_access_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES locations(id) ON DELETE CASCADE,
  ghl_contact_id text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  phone text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_ghl_idx ON contacts (ghl_contact_id);
CREATE INDEX IF NOT EXISTS contacts_location_idx ON contacts (location_id);

CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type text NOT NULL,
  content text NOT NULL,
  confidence real NOT NULL DEFAULT 0.7,
  source text,
  origin text NOT NULL DEFAULT 'engine',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_contact_idx ON memories (contact_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  scores jsonb NOT NULL,
  stage text NOT NULL,
  current_season text,
  best_memory text,
  last_meaningful_moment text,
  avoid_saying jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_best_conversation text,
  why_they_matter text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS snapshots_contact_idx ON snapshots (contact_id);

CREATE TABLE IF NOT EXISTS message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES snapshots(id) ON DELETE SET NULL,
  channel text NOT NULL,
  tone text NOT NULL,
  text text NOT NULL,
  grade jsonb,
  rewritten boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  inbound_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drafts_contact_idx ON message_drafts (contact_id);
CREATE INDEX IF NOT EXISTS drafts_status_idx ON message_drafts (status);

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_sms boolean NOT NULL DEFAULT false,
  auto_email boolean NOT NULL DEFAULT false,
  auto_inbox boolean NOT NULL DEFAULT false,
  auto_voicemail boolean NOT NULL DEFAULT false,
  humanity_threshold integer NOT NULL DEFAULT 95,
  sender_name text NOT NULL DEFAULT 'Jeremy Kean',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  action text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_action_idx ON audit_logs (action);

CREATE TABLE IF NOT EXISTS conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction text NOT NULL,
  channel text NOT NULL,
  body text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_contact_idx ON conversation_events (contact_id);
`;

let bootstrapped = false;

/** Create the schema (idempotent) and seed the default location. Safe to call on every boot. */
export async function bootstrapDatabase(): Promise<void> {
  const pool = getPool();
  if (!pool || bootstrapped) return;

  await pool.query(DDL);

  // Seed the single-tenant default location, keyed by the configured GHL
  // location id (or a "default" sentinel until GHL is connected).
  const defaultLocation = env.ghl.locationId || "default";
  await pool.query(
    `INSERT INTO locations (ghl_location_id, name)
     VALUES ($1, $2)
     ON CONFLICT (ghl_location_id) DO NOTHING`,
    [defaultLocation, env.senderName],
  );

  bootstrapped = true;
  console.log("  Database schema bootstrapped.");
}
