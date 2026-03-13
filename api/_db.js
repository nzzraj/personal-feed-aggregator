import pg from 'pg';
const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL;
const vercelPostgresUrl = process.env.POSTGRES_URL;
const supabaseProjectRef = process.env.SUPABASE_PROJECT_REF || '';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

if (!rawUrl && !vercelPostgresUrl) {
  console.error('[db] FATAL: DATABASE_URL and POSTGRES_URL are not set');
}

function extractProjectRef() {
  if (supabaseProjectRef) return supabaseProjectRef;
  if (!supabaseUrl) return '';
  try {
    const u = new URL(supabaseUrl);
    const [sub] = u.hostname.split('.');
    return sub || '';
  } catch {
    return '';
  }
}

const inferredProjectRef = extractProjectRef();

function safeLogUrl(url) {
  try {
    const u = new URL(url);
    const username = u.username ? `${u.username}@` : '';
    return `${username}${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

function appendCandidatesFromUrl(url, source, out) {
  if (!url) return;

  const pushCandidate = (u, reason) => {
    const value = u.toString();
    if (!out.some((c) => c.url === value)) out.push({ url: value, reason: `${source}:${reason}` });
  };

  try {
    const base = new URL(url);

    // Base URL as provided
    pushCandidate(base, 'as-provided');

    if (base.hostname.includes('pooler.supabase.com')) {
      const normalizedPooler = new URL(base.toString());

      // pooler should be aws-0-* and port 6543 in serverless
      normalizedPooler.hostname = normalizedPooler.hostname.replace(/^aws-\d+-/, 'aws-0-');
      if (normalizedPooler.port !== '6543') normalizedPooler.port = '6543';
      if (!normalizedPooler.searchParams.has('pgbouncer')) {
        normalizedPooler.searchParams.set('pgbouncer', 'true');
      }
      pushCandidate(normalizedPooler, 'normalized-pooler');

      // Common Supabase auth issue: username must be postgres.<project-ref> on pooler
      if (!normalizedPooler.username.includes('.') && inferredProjectRef) {
        const withTenantUser = new URL(normalizedPooler.toString());
        withTenantUser.username = `${withTenantUser.username}.${inferredProjectRef}`;
        pushCandidate(withTenantUser, 'pooler-tenant-username');
      }
    }
  } catch {
    out.push({ url, reason: `${source}:raw-unparseable` });
  }
}

function buildConnectionCandidates() {
  const candidates = [];
  appendCandidatesFromUrl(rawUrl, 'DATABASE_URL', candidates);
  appendCandidatesFromUrl(vercelPostgresUrl, 'POSTGRES_URL', candidates);

  return candidates;
}

const connectionCandidates = buildConnectionCandidates();
if (!connectionCandidates.length) {
  console.error('[db] FATAL: no valid connection candidates');
}

let pool = null;
let activeCandidate = null;

function createPool(connectionString) {
  const p = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 20000,
    ssl: { rejectUnauthorized: false },
  });

  p.on('error', (err) => {
    console.error('[db] Pool idle error:', err.message);
    if (pool === p) {
      pool = null;
      activeCandidate = null;
    }
  });

  return p;
}

async function connectPoolWithFallback() {
  if (pool) return pool;

  let lastError = null;

  for (const candidate of connectionCandidates) {
    const candidatePool = createPool(candidate.url);
    try {
      await candidatePool.query('SELECT 1 AS ok');
      pool = candidatePool;
      activeCandidate = candidate;
      console.log(`[db] Connected via candidate: ${candidate.reason} | ${safeLogUrl(candidate.url)}`);
      return pool;
    } catch (err) {
      lastError = err;
      console.error(`[db] Candidate failed: ${candidate.reason} | ${safeLogUrl(candidate.url)} | ${err.message}`);
      await candidatePool.end().catch(() => {});
    }
  }

  throw lastError || new Error('No database connection candidates available');
}

export async function query(sql, params) {
  const t = Date.now();
  try {
    const currentPool = await connectPoolWithFallback();
    const result = await currentPool.query(sql, params);
    console.log(`[db] OK ${Date.now() - t}ms | ${sql.slice(0, 60)}`);
    return result;
  } catch (err) {
    console.error(`[db] FAIL ${Date.now() - t}ms | ${err.message} | ${sql.slice(0, 60)}`);
    throw err;
  }
}

export async function healthCheck() {
  try {
    const currentPool = await connectPoolWithFallback();
    await currentPool.query('SELECT 1 AS ok');
    return {
      ok: true,
      candidate: activeCandidate?.reason || null,
      target: activeCandidate ? safeLogUrl(activeCandidate.url) : null,
    };
  } catch (err) {
    const hint = err.message?.toLowerCase().includes('tenant or user not found')
      ? 'Supabase pooler usually requires username like postgres.<project-ref>. Set SUPABASE_PROJECT_REF or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL so the project ref can be inferred.'
      : null;

    return {
      ok: false,
      error: err.message,
      code: err.code,
      hint,
    };
  }
}
