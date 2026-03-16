import { verifyToken } from './_jwt.js';

export function withAuth(handler) {
  return async (request, context) => {
    // GET requests are always public
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      return handler(request, context);
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return handler(request, context);
  };
}