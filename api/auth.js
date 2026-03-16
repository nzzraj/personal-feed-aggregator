import { withCors } from './_cors.js';
import { createToken } from './_jwt.js';

async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { password } = body;
  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[auth] ADMIN_PASSWORD env var not set');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  if (password !== adminPassword) {
    // Small delay to slow brute force
    await new Promise(r => setTimeout(r, 500));
    return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
  }

  const token = await createToken({ role: 'admin' });
  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default withCors(handler);