/**
 * Authentication middleware for all protected API endpoints
 * Validates API_KEY environment variable in Authorization header
 */

export function validateApiKey(request) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return {
      valid: false,
      error: 'Missing Authorization header',
      status: 401
    };
  }

  const bearerToken = authHeader.split(' ')[1];
  
  if (!bearerToken) {
    return {
      valid: false,
      error: 'Invalid Authorization format. Use: Authorization: Bearer {API_KEY}',
      status: 401
    };
  }

  const expectedKey = process.env.API_KEY;
  
  if (!expectedKey) {
    return {
      valid: false,
      error: 'Server error: API_KEY not configured',
      status: 500
    };
  }

  const isValid = bearerToken === expectedKey;
  
  return {
    valid: isValid,
    error: isValid ? null : 'Invalid API key',
    status: isValid ? 200 : 401
  };
}

/**
 * Wrapper to protect an endpoint with authentication
 * Usage: export default withAuth(handler);
 */
export function withAuth(handler) {
  return async (request) => {
    // Allow read-only GET requests without auth (optional — remove if you want full protection)
    if (request.method === 'GET') {
      // Uncomment next line to require auth for all methods
      // const auth = validateApiKey(request);
      // if (!auth.valid) {
      //   return new Response(JSON.stringify({ error: auth.error }), { status: auth.status });
      // }
      return handler(request);
    }

    // Require auth for POST, PUT, DELETE
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const auth = validateApiKey(request);
      if (!auth.valid) {
        return new Response(JSON.stringify({ error: auth.error }), { 
          status: auth.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return handler(request);
  };
}

/**
 * CORS headers helper
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

export function handleCorsPreFlight() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  });
}
