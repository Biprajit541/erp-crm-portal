import { Pool, QueryResultRow, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Return DATE columns (e.g. customers.follow_up_date) as plain "YYYY-MM-DD"
// strings. By default pg turns them into a JS Date at the server's local
// midnight, so on a machine ahead of UTC (like IST) the date came back one day
// early, and saving the edit form then moved it back another day.
types.setTypeParser(types.builtins.DATE, (value) => value);

// Supabase requires SSL. Locally you can also connect to a plain Postgres.
// DB_SSL=true/false forces it; if unset, SSL is on except for localhost.
function useSsl(): boolean {
  if (process.env.DB_SSL === "true") return true;
  if (process.env.DB_SSL === "false") return false;
  return !/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL || "");
}

// On AWS Lambda, every concurrent request runs in its own instance with its own
// pool, so each instance keeps very few connections and closes idle ones
// quickly. Use Supabase's transaction pooler URL (port 6543) there, so that
// many Lambda instances do not exhaust the database's connection limit.
const onLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl() ? { rejectUnauthorized: false } : false,
  max: onLambda ? Number(process.env.DB_POOL_MAX || 2) : 10,
  idleTimeoutMillis: onLambda ? 10_000 : 30_000,
  connectionTimeoutMillis: 10_000,
});

// Small helper so routes can just call query("SELECT ...", [params])
export function query<T extends QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params as any[]);
}