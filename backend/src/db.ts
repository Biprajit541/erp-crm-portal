import { Pool, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Supabase requires SSL. Locally you can also connect to a plain Postgres.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Small helper so routes can just call query("SELECT ...", [params])
export function query<T extends QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as any[]);
}