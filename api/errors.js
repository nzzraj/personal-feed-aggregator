import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';

async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // FIX: use dummy base for Vercel's relative URLs
    const url = new URL(request.url, 'http://localhost');
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 500);
    const endpoint = url.searchParams.get('endpoint');

    let sqlQuery = `SELECT id, api_endpoint, error_message, stack_trace, created_at FROM errors WHERE 1=1`;
    const params = [];

    if (endpoint) {
      sqlQuery += ` AND api_endpoint = $${params.length + 1}`;
      params.push(endpoint);
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(sqlQuery, params);

    const summaryResult = await query(`
      SELECT api_endpoint, COUNT(*) as count, MAX(created_at) as last_error
      FROM errors
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY api_endpoint
      ORDER BY count DESC
    `);

    return new Response(JSON.stringify({
      errors: result.rows,
      summary: summaryResult.rows,
      total: result.rows.length,
      timeRange: '24h'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error fetching errors:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch errors' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export default withCors(withAuth(handler));