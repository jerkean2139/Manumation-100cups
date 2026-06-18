import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * Database access.
 *
 * The DB is optional at boot: the app still runs (and the demo flow works)
 * without Postgres, but persistence is disabled. This keeps local development
 * and the relationship-intelligence demo unblocked while DATABASE_URL is set
 * up. `getDb()` returns null when there's no connection.
 */

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (env.databaseUrl) {
  pool = new pg.Pool({
    connectionString: env.databaseUrl,
    // Railway Postgres requires SSL in production.
    ssl: env.isProduction ? { rejectUnauthorized: false } : undefined,
  });
  dbInstance = drizzle(pool, { schema });
}

export const getDb = () => dbInstance;
export const hasDb = () => dbInstance !== null;
export { schema };
