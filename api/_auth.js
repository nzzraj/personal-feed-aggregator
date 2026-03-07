export function validateApiKey(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { valid: false, error: 'Missing Authorization header', status: 401 };
  const bearerToken = authHeader.split(' ')[1];
  if (!bearerToken) return { valid: false, error: 'Invalid Authorization format. Use: Authorization: Bearer {API_KEY}', status: 401 };
  const expectedKey = process.env.API_KEY;
  if (!expectedKey) return { valid: false, error: 'Server error: API_KEY not configured', status: 500 };
  const isValid = bearerToken === expectedKey;
  return { valid: isValid, error: isValid ? null : 'Invalid API key', status: isValid ? 200 : 401 };
}

export function withAuth(handler) {
  return async (request) => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const auth = validateApiKey(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), {
          status: auth.status, headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return handler(request);
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