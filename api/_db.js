import pg from 'pg';
const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL;

if (!rawUrl) {
  console.error('[db] FATAL: DATABASE_URL not set');
}

// Log connection target (no password) for debugging
function safeLogUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}${u.pathname}`;
  } catch { return '(unparseable)'; }
}

// Fix common Supabase URL mistakes
function fixUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Wrong pooler hostname prefix (aws-1-, aws-2-, etc → aws-0-)
    if (u.hostname.includes('pooler.supabase.com')) {
      u.hostname = u.hostname.replace(/^aws-\d+-/, 'aws-0-');
      // Must use port 6543 for transaction pooler
      if (u.port !== '6543') {
        console.warn(`[db] Fixing port ${u.port} → 6543`);
        u.port = '6543';
      }
      // pgbouncer mode required
      if (!u.searchParams.has('pgbouncer')) {
        u.searchParams.set('pgbouncer', 'true');
      }
    }
    return u.toString();
  } catch { return url; }
}

const connectionString = fixUrl(rawUrl);
console.log('[db] Connecting to:', safeLogUrl(connectionString));

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      statement_timeout: 20000,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      console.error('[db] Pool idle error:', err.message);
      pool = null;
    });
  }
  return pool;
}

export async function query(sql, params) {
  const t = Date.now();
  try {
    const result = await getPool().query(sql, params);
    console.log(`[db] OK ${Date.now()-t}ms | ${sql.slice(0,60)}`);
    return result;
  } catch (err) {
    console.error(`[db] FAIL ${Date.now()-t}ms | ${err.message} | ${sql.slice(0,60)}`);
    throw err;
  }
}

export async function healthCheck() {
  try {
    const r = await getPool().query('SELECT 1 AS ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message, code: err.code };
  }
}