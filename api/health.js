import { healthCheck } from './_db.js';
import { withCors } from './_cors.js';

async function handler(request) {
  const db = await healthCheck();
  const rawUrl = process.env.DATABASE_URL || '';
  let urlInfo = 'NOT SET';
  try {
    const u = new URL(rawUrl);
    urlInfo = `${u.hostname}:${u.port}${u.pathname}`;
  } catch {}

  return new Response(JSON.stringify({
    status: db.ok ? 'ok' : 'error',
    db,
    connection: urlInfo,
    node: process.version,
    ts: new Date().toISOString(),
  }, null, 2), {
    status: db.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default withCors(handler);