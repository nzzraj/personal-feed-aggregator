import { query } from '../_db.js';
import { withCors } from '../_cors.js';
import { logError } from '../_logger.js';

async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    if (!searchQuery || searchQuery.trim().length < 2) {
      return new Response(
        JSON.stringify({ error: 'Search query must be at least 2 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use Postgres full-text search if available, fallback to ILIKE
    // ILIKE is case-insensitive and works on partial matches
    const searchPattern = `%${searchQuery}%`;

    const result = await query(
      `SELECT 
        a.id,
        a.title,
        a.url,
        a.excerpt,
        a.pub_date,
        a.read,
        a.saved,
        a.read_time_minutes,
        s.id as source_id,
        s.title as source_title,
        -- Calculate relevance (title matches are scored higher)
        CASE 
          WHEN a.title ILIKE $1 THEN 2
          ELSE 1
        END as relevance
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE a.title ILIKE $1 
         OR a.excerpt ILIKE $1
      ORDER BY relevance DESC, a.pub_date DESC
      LIMIT $2 OFFSET $3`,
      [searchPattern, limit, offset]
    );

    return new Response(
      JSON.stringify({
        results: result.rows,
        query: searchQuery,
        count: result.rows.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await logError('/api/search', error, error.stack);
    console.error('Error searching articles:', error);

    return new Response(
      JSON.stringify({ error: 'Failed to search articles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default withCors(handler);
