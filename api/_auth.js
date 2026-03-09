// By the time this runs, request has already been normalized by withCors
// into a proper Fetch API Request, so .headers.get() always works.

export function validateApiKey(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header', status: 401 };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { valid: false, error: 'Invalid Authorization format. Use: Authorization: Bearer {API_KEY}', status: 401 };
  }

  const bearerToken = parts[1];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.warn('WARNING: API_KEY env var not set — accepting any non-empty token.');
    return { valid: !!bearerToken, error: bearerToken ? null : 'Missing token', status: bearerToken ? 200 : 401 };
  }

  const isValid = bearerToken === expectedKey;
  return {
    valid: isValid,
    error: isValid ? null : 'Invalid API key',
    status: isValid ? 200 : 401,
  };
}

export function withAuth(handler) {
  return async (request, context) => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const auth = validateApiKey(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return handler(request, context);
  };
}

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export function handleCorsPreFlight() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}