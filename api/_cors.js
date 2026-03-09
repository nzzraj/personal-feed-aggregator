const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://neerajfeed.vercel.app',
  'https://personal-feed-aggregator.vercel.app',
  'https://myreadfeed.vercel.app',
];

export function getCorsHeaders(origin = '*') {
  const isAllowed = !origin || origin === '*' || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : ALLOWED_ORIGINS[2],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Normalize whatever Vercel passes us into a proper Fetch API Request object.
 * Vercel Node 24.x passes a raw http.IncomingMessage (no .json(), no .headers.get(), etc.)
 * Older runtimes passed a proper Request. This handles both.
 */
async function normalizeRequest(req) {
  // Already a Fetch API Request — has .json(), .text(), .headers.get()
  if (typeof req.json === 'function') return req;

  // It's a Node.js http.IncomingMessage — convert it
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v));
    } else if (value != null) {
      headers.set(key, value);
    }
  }

  // Read the raw body from the stream
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const method = req.method || 'GET';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  return new Request(url, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : body,
  });
}

export function withCors(handler) {
  return async (req, context) => {
    let request;
    try {
      request = await normalizeRequest(req);
    } catch (err) {
      console.error('Failed to normalize request:', err);
      return new Response(JSON.stringify({ error: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin') || '*';
      return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
    }

    const origin = request.headers.get('origin') || '*';

    try {
      const response = await handler(request, context);
      const corsHeaders = getCorsHeaders(origin);
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('Handler error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  };
}

export function handleCorsPreFlight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get('origin') || '*'),
    });
  }
  return null;
}