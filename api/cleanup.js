import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';

async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const daysToKeep = parseInt(body.days_to_keep) || 60;

    // Delete read articles older than N days
    const result = await query(
      `DELETE FROM articles
       WHERE read = true
         AND pub_date < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [daysToKeep]
    );

    const deleted = result.rows.length;

    // Current article count after cleanup
    const countResult = await query('SELECT COUNT(*) as total FROM articles');
    const remaining = parseInt(countResult.rows[0].total);

    return new Response(JSON.stringify({
      deleted,
      remaining,
      daysToKeep,
      timestamp: new Date().toISOString()
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    await logError('/api/cleanup', error, error.stack);
    return new Response(JSON.stringify({ error: 'Cleanup failed', detail: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default withCors(withAuth(handler));