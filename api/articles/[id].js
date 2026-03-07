import { query } from '../_db.js';
import { withCors } from '../_cors.js';
import { withAuth } from '../_auth.js';
import { logError } from '../_logger.js';

async function handler(request, context) {
  try {
    const id = context.params.id;

    if (request.method === 'GET') {
      // Get single article with full content
      const result = await query(
        `SELECT 
          a.id,
          a.title,
          a.url,
          a.content,
          a.excerpt,
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
        WHERE a.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Article not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify(result.rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'PUT') {
      // Update article read/saved state
      const body = await request.json();
      const { read, saved } = body;

      const updates = [];
      const params = [id];
      let paramCount = 2;

      if (read !== undefined) {
        updates.push(`read = $${paramCount}`);
        params.push(read);
        paramCount++;
      }

      if (saved !== undefined) {
        updates.push(`saved = $${paramCount}`);
        params.push(saved);
        paramCount++;
      }

      if (updates.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No fields to update' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const result = await query(
        `UPDATE articles 
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Article not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify(result.rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      // Delete article (requires API key)
      const result = await query(
        'DELETE FROM articles WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Article not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await logError(`/api/articles/[id]`, error, error.stack);
    console.error('Error processing article:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default withCors(withAuth(handler));
