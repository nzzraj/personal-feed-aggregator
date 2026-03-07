import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 10000
    });
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      pool = null; // force reconnect next time
    });
  }
  return pool;
}

export async function query(sql, params) {
  try {
    const result = await getPool().query(sql, params);
    return result;
  } catch (error) {
    console.error('Query error:', {
      message: error.message,
      sql: sql.substring(0, 100),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function healthCheck() {
  try {
    const result = await getPool().query('SELECT NOW()');
    return { ok: true, timestamp: result.rows[0].now };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function shutdown() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}