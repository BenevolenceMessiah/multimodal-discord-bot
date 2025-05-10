import { Pool } from 'pg';
import { config } from '../src/config.js';

let pool: Pool;
if (config.postgres?.enabled) {
  pool = new Pool({ connectionString: config.postgres.url });
}

export async function logInteraction(
  guildId: string,
  userId: string,
  command: string,
  latency: number
) {
  if (!pool) return;
  await pool.query(
    `INSERT INTO interactions(guild_id,user_id,command,latency_ms,created_at)
      VALUES ($1,$2,$3,$4,now())`,
    [guildId, userId, command, latency]
  );
}