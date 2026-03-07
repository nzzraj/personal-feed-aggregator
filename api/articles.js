import { query } from './_db.js';
import { withCors } from './_cors.js';
import { logError } from './_logger.js';

async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(request.url);
    
    // Query parameters
    const sourceId = url.searchParams.get('source_id');
    const filter = url.searchParams.get('filter') || 'all'; // all, unread, read, saved, today
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200); // Cap at 200
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    const search = url.searchParams.get('search') || '';

    let sqlQuery = `
      SELECT 
        a.id,
        a.title,
        a.url,
        a.excerpt,
        a.content,
        a.pub_date,
        a.read,
        a.saved,
        a.read_time_minutes,
        a.word_count,
        s.id as source_id,
        s.title as source_title,
        s.category as source_category
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by source
    if (sourceId) {
      sqlQuery += ` AND a.source_id = $${params.length + 1}`;
      params.push(sourceId);
    }

    // Filter by read status
    if (filter === 'unread') {
      sqlQuery += ` AND a.read = false`;
    } else if (filter === 'read') {
      sqlQuery += ` AND a.read = true`;
    } else if (filter === 'saved') {
      sqlQuery += ` AND a.saved = true`;
    } else if (filter === 'today') {
      sqlQuery += ` AND a.pub_date > NOW() - INTERVAL '24 hours'`;
    }

    // Full-text search
    if (search) {
      // Use Postgres full-text search if available, fallback to ILIKE
      sqlQuery += ` AND (
        a.title ILIKE $${params.length + 1}
        OR a.excerpt ILIKE $${params.length + 1}
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern);
      params.push(searchPattern);
    }

    // Count total before pagination
    const countQuery = sqlQuery.replace(
      /SELECT.*FROM/,
      'SELECT COUNT(*) as count FROM'
    );
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Apply sorting and pagination
    sqlQuery += ` ORDER BY a.pub_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit);
    params.push(offset);

    const result = await query(sqlQuery, params);

    return new Response(
      JSON.stringify({
        articles: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
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
