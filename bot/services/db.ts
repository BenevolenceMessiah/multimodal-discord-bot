import { Pool } from 'pg';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js'; // Import logger

let pool: Pool | undefined;

async function initializeDatabase() {
  if (config.postgres?.enabled) {
    pool = new Pool({ connectionString: config.postgres.url });

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS interactions (
          id SERIAL PRIMARY KEY,
          guild_id VARCHAR(255),
          user_id VARCHAR(255) NOT NULL,
          command VARCHAR(255) NOT NULL,
          latency_ms INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      logger.info('Postgres: "interactions" table checked/created successfully.');
    } catch (err: any) {
      logger.error(`Postgres: Failed to create "interactions" table: ${err.message}`);
      // Depending on severity, you might want to throw the error or disable DB logging features
      pool = undefined; // Prevent further use if table creation fails
    }
  }
}

// Call initializeDatabase when the module is loaded.
// This ensures it runs when the bot starts up.
initializeDatabase().catch(err => {
  logger.error(`Failed to initialize database connection or table: ${err.message}`);
});

export async function logInteraction(
  guildId: string,
  userId: string,
  command: string,
  latency: number
): Promise<void> {
  if (!pool) {
    // Log to console if DB is not available
    // logger.warn(`Postgres disabled or not initialized, skipping logInteraction for command: ${command}`);
    return;
  }
  try {
    await pool.query(
      `INSERT INTO interactions(guild_id,user_id,command,latency_ms,created_at)
        VALUES ($1,$2,$3,$4,now())`,
      [guildId, userId, command, latency]
    );
  } catch (err: any) {
    logger.error(`Failed to log interaction to Postgres: ${err.message}`);
  }
}