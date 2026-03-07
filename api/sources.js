import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';

async function handler(request, context) {
  try {
    const id = context?.params?.id;

    if (request.method === 'GET') {
      if (id) {
        const result = await query(
          `SELECT 
            s.id,
            s.feed_url as url,
            s.url as website_url,
            COALESCE(s.name, s.feed_url) as title,
            COALESCE(s.category, 'Uncategorized') as category,
            COALESCE(s.active, true) as active,
            COUNT(a.id) as total_articles,
            COUNT(CASE WHEN a.read = false THEN 1 END) as unread_count
          FROM sources s
          LEFT JOIN articles a ON s.id = a.source_id
          WHERE s.id = $1
          GROUP BY s.id, s.feed_url, s.url, s.name, s.category, s.active`,
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
      // FIX: use 'name' column (not 'title'), expose feed_url as url for frontend compatibility
      const result = await query(
        `SELECT 
          s.id,
          s.feed_url as url,
          s.url as website_url,
          COALESCE(s.name, s.feed_url) as title,
          COALESCE(s.category, 'Uncategorized') as category,
          COALESCE(s.active, true) as active,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.read = false THEN 1 END) as unread_count
        FROM sources s
        LEFT JOIN articles a ON s.id = a.source_id
        GROUP BY s.id, s.feed_url, s.url, s.name, s.category, s.active
        ORDER BY COALESCE(s.name, s.feed_url)`
      );

      return new Response(JSON.stringify(result.rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      // Frontend sends: { title (name), url (website), feedUrl (RSS feed) }
      // OR old format: { title, url } where url might be the feed
      const { title, url, feedUrl, feed_url } = body;
      const rssFeedUrl = feedUrl || feed_url || url;
      const websiteUrl = url || rssFeedUrl;

      if (!rssFeedUrl) {
        return new Response(
          JSON.stringify({ error: 'Feed URL is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        // FIX: Insert into correct columns: name, url (website), feed_url (RSS)
        const result = await query(
          `INSERT INTO sources (name, url, feed_url, active)
           VALUES ($1, $2, $3, true)
           RETURNING id, name as title, feed_url as url, url as website_url, category, active`,
          [title || rssFeedUrl, websiteUrl, rssFeedUrl]
        );

        return new Response(JSON.stringify(result.rows[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        if (error.code === '23505') {
          return new Response(
            JSON.stringify({ error: 'Source feed URL already exists' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
    }

    if (request.method === 'PUT') {
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
        // FIX: update 'name' not 'title'
        updates.push(`name = $${paramCount}`);
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
         RETURNING id, name as title, feed_url as url, url as website_url, category, active`,
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
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        await query('BEGIN');
        await query('DELETE FROM articles WHERE source_id = $1', [id]);
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