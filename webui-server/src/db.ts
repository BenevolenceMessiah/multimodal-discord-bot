import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
    || 'postgres://bot:bot@postgres:5432/bot',
});

export async function ensureSchema() {
  await pool.query(`
    create extension if not exists "pgcrypto";

    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      title text not null default 'New Chat',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists messages (
      id uuid primary key default gen_random_uuid(),
      session_id uuid references sessions(id) on delete cascade,
      role text not null,
      content text,
      type text,
      mime  text,
      data  bytea,
      created_at timestamptz default now()
    );
  `);
}
