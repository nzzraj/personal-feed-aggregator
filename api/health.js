import { healthCheck } from './_db.js';
import { withCors } from './_cors.js';

async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const dbHealth = await healthCheck();
    return new Response(JSON.stringify({
      status: dbHealth.ok ? 'ok' : 'unhealthy',
      database: dbHealth.ok ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    }), { status: dbHealth.ok ? 200 : 503, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', database: 'error', error: error.message, timestamp: new Date().toISOString() }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default withCors(handler);