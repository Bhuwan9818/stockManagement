import { Pool, PoolClient } from 'pg';

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

function getPool(): Pool {
  if (globalForPg.pgPool) return globalForPg.pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to your .env.local file.');
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1');

  const p = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPg.pgPool = p;
  }

  return p;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client?.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
