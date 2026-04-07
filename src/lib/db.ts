import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __patientPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
const poolMax = Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10);
const idleTimeoutMillis = Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? "30000", 10);
const connectionTimeoutMillis = Number.parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? "10000", 10);
const enableSsl = process.env.DB_SSL === "true";
const normalizedPoolMax = Number.isFinite(poolMax) ? Math.max(poolMax, 10) : 10;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool =
  global.__patientPool ??
  new Pool({
    connectionString,
    max: normalizedPoolMax,
    idleTimeoutMillis: Number.isFinite(idleTimeoutMillis) ? idleTimeoutMillis : 30000,
    connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis) ? connectionTimeoutMillis : 10000,
    ssl: enableSsl ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  global.__patientPool = pool;
}

export async function dbQuery<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export async function dbTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
