// Works with both Fetch API Request (headers.get) and Node IncomingMessage (headers['x'])
function getHeader(request, name) {
  if (typeof request.headers?.get === 'function') {
    return request.headers.get(name);
  }
  return request.headers?.[name.toLowerCase()] ?? null;
}

export function validateApiKey(request) {
  const authHeader = getHeader(request, 'authorization');

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
    // Env var not configured — log loudly but don't 500. Accept any non-empty token.
    console.warn('WARNING: API_KEY env var is not set. All write requests are being accepted.');
    return { valid: !!bearerToken, error: bearerToken ? null : 'Missing token', status: bearerToken ? 200 : 401 };
  }

  const isValid = bearerToken === expectedKey;
  return {
    valid: isValid,
    error: isValid ? null : 'Invalid API key',
    status: isValid ? 200 : 401
  };
}

export function withAuth(handler) {
  return async (request, context) => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const auth = validateApiKey(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    // Always forward context so dynamic routes get their params
    return handler(request, context);
  };
}

export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

export function handleCorsPreFlight() {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
}