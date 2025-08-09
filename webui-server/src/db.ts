import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // You can still run the server without DB, but endpoints will fail.
  // Consider exiting if DB is mandatory in your deployment.
  // console.warn('[db] DATABASE_URL is not set. Postgres features disabled.');
}

export const pool = new Pool({
  connectionString,
  // Enable TLS in prod if your provider requires it:
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/**
 * Creates minimal schema if it doesn't exist.
 * sessions: lightweight chat container
 * messages: per-session transcript entries
 *
 * We use TEXT ids for sessions so we can generate them app-side (UUID).
 * Index on (session_id, created_at) for fast load of a chat.
 */
export async function ensureSchema(): Promise<void> {
  if (!connectionString) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         BIGSERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role       TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      type       TEXT NOT NULL,
      content    JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_created
      ON messages (session_id, created_at);
  `);
}
