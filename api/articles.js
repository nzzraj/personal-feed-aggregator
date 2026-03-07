import { query } from './_db.js';
import { withCors } from './_cors.js';
import { logError } from './_logger.js';

async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url, 'http://localhost');

    const sourceId = url.searchParams.get('source_id');
    const filter = url.searchParams.get('filter') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const search = url.searchParams.get('search') || '';

    const conditions = ['1=1'];
    const params = [];

    if (sourceId) {
      params.push(sourceId);
      conditions.push(`a.source_id = $${params.length}`);
    }

    if (filter === 'unread') conditions.push(`a.read = false`);
    else if (filter === 'read') conditions.push(`a.read = true`);
    else if (filter === 'saved') conditions.push(`a.saved = true`);
    else if (filter === 'today') conditions.push(`a.pub_date > NOW() - INTERVAL '24 hours'`);

    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      conditions.push(`(a.title ILIKE $${p} OR a.excerpt ILIKE $${p})`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await query(
      `SELECT COUNT(*) as count FROM articles a JOIN sources s ON a.source_id = s.id WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const sqlQuery = `
      SELECT
        a.id, a.title, a.url, a.excerpt, a.content, a.pub_date,
        a.read, a.saved, a.read_time_minutes, a.word_count,
        s.id as source_id, s.name as source_title, s.category as source_category
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE ${whereClause}
      ORDER BY a.pub_date DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(sqlQuery, params);

    return new Response(
      JSON.stringify({
        articles: result.rows,
        pagination: { total, limit, offset, hasMore: offset + limit < total }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await logError('/api/articles', error, error.stack);
    console.error('Error fetching articles:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default withCors(handler);