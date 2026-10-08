// Migrations run atomically; user_version advances only after all DDL succeeds.
export const migrations = [
  `
CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, calendar_id TEXT NOT NULL, google_id TEXT NOT NULL, data TEXT NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL);
CREATE UNIQUE INDEX event_identity ON entries(calendar_id, google_id);
CREATE TABLE IF NOT EXISTS queue (entry_id TEXT PRIMARY KEY, operation TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0, in_flight INTEGER NOT NULL DEFAULT 0, attempted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conflicts (id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id TEXT NOT NULL UNIQUE, local_data TEXT NOT NULL, remote_data TEXT NOT NULL, created_at TEXT NOT NULL);
`,
];
