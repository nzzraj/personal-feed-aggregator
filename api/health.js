import { healthCheck } from './_db.js';
import { withCors } from './_cors.js';

function safeConnectionInfo(rawUrl) {
  if (!rawUrl) return 'NOT SET';
  try {
    const u = new URL(rawUrl);
    const username = u.username ? `${u.username}@` : '';
    return `${username}${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

async function handler(request) {
  const db = await healthCheck();
  const rawDatabaseUrl = process.env.DATABASE_URL || '';
  const rawPostgresUrl = process.env.POSTGRES_URL || '';

  return new Response(JSON.stringify({
    status: db.ok ? 'ok' : 'error',
    db,
    connection: {
      databaseUrl: safeConnectionInfo(rawDatabaseUrl),
      postgresUrl: safeConnectionInfo(rawPostgresUrl),
    },
    env: {
      hasDatabaseUrl: Boolean(rawDatabaseUrl),
      hasPostgresUrl: Boolean(rawPostgresUrl),
      hasSupabaseProjectRef: Boolean(process.env.SUPABASE_PROJECT_REF),
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    node: process.version,
    ts: new Date().toISOString(),
  }, null, 2), {
    status: db.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default withCors(handler);
