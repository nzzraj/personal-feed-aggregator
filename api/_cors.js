/**
 * Unified CORS middleware
 * Centralizes CORS logic so it doesn't need to be duplicated across 6 API files
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://neerajfeed.vercel.app',
  'https://personal-feed-aggregator.vercel.app',
  'https://symphonious-piroshki-43b8df.netlify.app',
  // Add more origins here if needed
];

/**
 * Get CORS headers for a given origin
 */
export function getCorsHeaders(origin = '*') {
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === '*';
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Handle CORS pre-flight OPTIONS requests
 */
export function handleCorsPreFlight(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get('origin'))
    });
  }
  return null; // Not a pre-flight request
}

/**
 * Wrap a handler with CORS support
 * Usage: export default withCors(handler);
 */
export function withCors(handler) {
  return async (request) => {
    // Handle pre-flight
    const preFlightResponse = handleCorsPreFlight(request);
    if (preFlightResponse) {
      return preFlightResponse;
    }

    // Handle actual request
    try {
      const response = await handler(request);
      
      // Add CORS headers to response
      const corsHeaders = getCorsHeaders(request.headers.get('origin'));
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error('CORS handler error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            ...getCorsHeaders(request.headers.get('origin')),
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };
}
