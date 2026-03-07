import { query } from '../_db.js';
import { withCors } from '../_cors.js';
import { withAuth } from '../_auth.js';
import { logError } from '../_logger.js';

async function handler(request, context) {
  try {
    const id = context?.params?.id;

    if (request.method === 'GET') {
      if (id) {
        // Get single source
        const result = await query(
          `SELECT 
            s.id,
            s.url,
            COALESCE(s.title, s.url) as title,
            COALESCE(s.category, 'Uncategorized') as category,
            COALESCE(s.active, true) as active,
            COUNT(a.id) as total_articles,
            COUNT(CASE WHEN a.read = false THEN 1 END) as unread_count
          FROM sources s
          LEFT JOIN articles a ON s.id = a.source_id
          WHERE s.id = $1
          GROUP BY s.id, s.url, s.title, s.category, s.active`,
          [id]
        );

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Source not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify(result.rows[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get all sources with unread counts
      const result = await query(
        `SELECT 
          s.id,
          s.url,
          COALESCE(s.title, s.url) as title,
          COALESCE(s.category, 'Uncategorized') as category,
          COALESCE(s.active, true) as active,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.read = false THEN 1 END) as unread_count
        FROM sources s
        LEFT JOIN articles a ON s.id = a.source_id
        GROUP BY s.id, s.url, s.title, s.category, s.active
        ORDER BY COALESCE(s.title, s.url)`
      );

      return new Response(JSON.stringify(result.rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      // Add new source
      const body = await request.json();
      const { url, title, category = null } = body;

      if (!url) {
        return new Response(
          JSON.stringify({ error: 'URL is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const result = await query(
          `INSERT INTO sources (url, title, category, active)
           VALUES ($1, $2, $3, true)
           RETURNING *`,
          [url, title || url, category]
        );

        return new Response(JSON.stringify(result.rows[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        if (error.code === '23505') {
          // Unique constraint violation
          return new Response(
            JSON.stringify({ error: 'Source URL already exists' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
    }

    if (request.method === 'PUT') {
      // Update source (pause/unpause, rename, etc.)
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const body = await request.json();
      const { active, title, category } = body;

      const updates = [];
      const params = [id];
      let paramCount = 2;

      if (active !== undefined) {
        updates.push(`active = $${paramCount}`);
        params.push(active);
        paramCount++;
      }

      if (title !== undefined) {
        updates.push(`title = $${paramCount}`);
        params.push(title);
        paramCount++;
      }

      if (category !== undefined) {
        updates.push(`category = $${paramCount}`);
        params.push(category);
        paramCount++;
      }

      if (updates.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No fields to update' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const result = await query(
        `UPDATE sources 
         SET ${updates.join(', ')}
         WHERE id = $1
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Source not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify(result.rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      // Delete source and all its articles
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Use transaction to ensure consistency
      try {
        await query('BEGIN');
        
        // Delete articles first
        await query('DELETE FROM articles WHERE source_id = $1', [id]);
        
        // Then delete source
        const result = await query(
          'DELETE FROM sources WHERE id = $1 RETURNING id',
          [id]
        );
        
        await query('COMMIT');

        if (result.rows.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Source not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ deleted: true, id: result.rows[0].id }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (txError) {
        await query('ROLLBACK');
        throw txError;
      }
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await logError(`/api/sources${context?.params?.id ? `/${context.params.id}` : ''}`, error, error.stack);
    console.error('Error processing sources:', error);

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default withCors(withAuth(handler));
