import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';

function getArticleIdFromPath(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.length >= 3 ? parts[2] : null;
}

async function listArticles(request) {
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
}

async function updateArticle(request) {
  const id = getArticleIdFromPath(request.url);
  if (!id) {
    return new Response(JSON.stringify({ error: 'Article ID required in path /api/articles/{id}' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const body = await request.json();
  const updates = [];
  const params = [id];
  let p = 2;

  if (body.read !== undefined) {
    updates.push(`read = $${p}`);
    params.push(Boolean(body.read));
    p++;
  }

  if (body.saved !== undefined) {
    updates.push(`saved = $${p}`);
    params.push(Boolean(body.saved));
    p++;
  }

  if (!updates.length) {
    return new Response(JSON.stringify({ error: 'No updatable fields provided. Use read and/or saved.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await query(
    `UPDATE articles SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1
     RETURNING id, read, saved, updated_at`,
    params
  );

  if (!result.rows.length) {
    return new Response(JSON.stringify({ error: 'Article not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(result.rows[0]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handler(request) {
  try {
    if (request.method === 'GET') return listArticles(request);
    if (request.method === 'PUT') return updateArticle(request);

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    await logError('/api/articles', error, error.stack);
    console.error('Error handling articles:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process article request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default withCors(withAuth(handler));
