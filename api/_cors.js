const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Normalize a Node.js IncomingMessage → duck-typed Fetch Request.
 * 
 * The key insight: on GET/HEAD/OPTIONS, we must NOT attach stream listeners
 * because Vercel's runtime may have already ended the stream, which means
 * req.on('end') never fires and the Promise hangs forever.
 */
async function normalizeRequest(req) {
  // Already a proper Fetch API Request (has .json(), .headers.get())
  if (typeof req.json === 'function') return req;

  const method = (req.method || 'GET').toUpperCase();
  const proto  = req.headers['x-forwarded-proto'] || 'https';
  const host   = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost';
  const url    = `${proto}://${host}${req.url || '/'}`;

  // Build normalized headers
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }

  // Only read body for methods that can have one
  let bodyText = '';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Vercel may buffer the body in req.body (as string/object) before we get here
    if (req.body !== undefined && req.body !== null) {
      bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    } else {
      // Stream hasn't been read yet — read it with a timeout guard
      bodyText = await new Promise((resolve) => {
        const chunks = [];
        const timer = setTimeout(() => resolve(''), 5000); // never hang >5s
        req.on('data', chunk => chunks.push(chunk));
        req.on('end',  () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')); });
        req.on('error',() => { clearTimeout(timer); resolve(''); });
        // If stream already ended (readableEnded), resolve immediately
        if (req.readableEnded || req.readableLength === 0 && req.readable === false) {
          clearTimeout(timer);
          resolve('');
        }
      });
    }
  }

  const parsedBody = bodyText ? bodyText : null;

  return {
    method,
    url,
    headers,
    json:        async () => parsedBody ? JSON.parse(parsedBody) : {},
    text:        async () => parsedBody || '',
    arrayBuffer: async () => parsedBody ? Buffer.from(parsedBody).buffer : new ArrayBuffer(0),
  };
}

export function withCors(handler) {
  return async (req, res) => {
    // ── Normalize request ──────────────────────────────────────────
    let request;
    try {
      request = await normalizeRequest(req);
    } catch (err) {
      console.error('[cors] normalizeRequest failed:', err.message);
      const body = JSON.stringify({ error: 'Bad request', detail: err.message });
      if (res?.setHeader) {
        Object.entries(CORS_HEADERS).forEach(([k,v]) => res.setHeader(k, v));
        res.statusCode = 400;
        res.end(body);
      }
      return new Response(body, { status: 400, headers: CORS_HEADERS });
    }

    // ── OPTIONS preflight ──────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      if (res?.setHeader) {
        Object.entries(CORS_HEADERS).forEach(([k,v]) => res.setHeader(k, v));
        res.statusCode = 204;
        res.end();
        return;
      }
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Run handler ────────────────────────────────────────────────
    let fetchResponse;
    try {
      fetchResponse = await handler(request);
    } catch (err) {
      console.error('[cors] handler threw:', err.message, err.stack);
      fetchResponse = new Response(
        JSON.stringify({ error: 'Internal server error', detail: err.message }),
        { status: 500 }
      );
    }

    // ── Add CORS headers & send ────────────────────────────────────
    const outHeaders = new Headers(fetchResponse.headers);
    Object.entries(CORS_HEADERS).forEach(([k,v]) => outHeaders.set(k, v));
    if (!outHeaders.has('Content-Type')) outHeaders.set('Content-Type', 'application/json');

    const outBody = await fetchResponse.text();

    if (res?.setHeader) {
      // Node-style response (Vercel passes (req, res))
      outHeaders.forEach((v, k) => res.setHeader(k, v));
      res.statusCode = fetchResponse.status || 200;
      res.end(outBody);
      return;
    }

    return new Response(outBody, { status: fetchResponse.status, headers: outHeaders });
  };
}