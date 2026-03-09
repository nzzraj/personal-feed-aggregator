const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://neerajfeed.vercel.app',
  'https://personal-feed-aggregator.vercel.app',
  'https://myreadfeed.vercel.app',
];

// Works with both Fetch API Request (headers.get) and Node IncomingMessage (headers['x'])
function getHeader(request, name) {
  if (typeof request.headers?.get === 'function') {
    return request.headers.get(name);
  }
  // Node IncomingMessage: headers is a plain lowercase object
  return request.headers?.[name.toLowerCase()] ?? null;
}

export function getCorsHeaders(origin = '*') {
  const isAllowed = !origin || origin === '*' || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : ALLOWED_ORIGINS[2],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

export function handleCorsPreFlight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(getHeader(request, 'origin'))
    });
  }
  return null;
}

export function withCors(handler) {
  return async (request, context) => {
    const preFlightResponse = handleCorsPreFlight(request);
    if (preFlightResponse) return preFlightResponse;

    try {
      const response = await handler(request, context);
      const corsHeaders = getCorsHeaders(getHeader(request, 'origin'));
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
      headers.set('Content-Type', 'application/json');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error('Handler error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          ...getCorsHeaders(getHeader(request, 'origin')),
          'Content-Type': 'application/json'
        }
      });
    }
  };
}