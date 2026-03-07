import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';

async function handler(request) {
  try {
    // Extract optional ID from URL: /api/sources or /api/sources/123
    const url = new URL(request.url, 'http://localhost');
    const pathParts = url.pathname.split('/').filter(Boolean);
    // pathParts = ['api', 'sources'] or ['api', 'sources', '123']
    const id = pathParts.length >= 3 ? pathParts[2] : null;

    if (request.method === 'GET') {
      const baseSelect = `
        SELECT
          s.id,
          s.name as title,
          s.url as website_url,
          s.feed_url as url,
          COALESCE(s.category, 'Uncategorized') as category,
          COALESCE(s.active, true) as active,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.read = false THEN 1 END) as unread_count
        FROM sources s
        LEFT JOIN articles a ON s.id = a.source_id
      `;

      if (id) {
        const result = await query(
          baseSelect + ` WHERE s.id = $1 GROUP BY s.id, s.name, s.url, s.feed_url, s.category, s.active`,
          [id]
        );
        if (!result.rows.length) {
          return new Response(JSON.stringify({ error: 'Source not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify(result.rows[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await query(
        baseSelect + ` GROUP BY s.id, s.name, s.url, s.feed_url, s.category, s.active ORDER BY COALESCE(s.name, s.feed_url)`
      );
      return new Response(JSON.stringify(result.rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { title, url: bodyUrl, feedUrl, feed_url } = body;
      const rssFeedUrl = feedUrl || feed_url || bodyUrl;
      const websiteUrl = (bodyUrl && bodyUrl !== rssFeedUrl ? bodyUrl : null) || rssFeedUrl;

      if (!rssFeedUrl) {
        return new Response(JSON.stringify({ error: 'Feed URL is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        const result = await query(
          `INSERT INTO sources (name, url, feed_url, active)
           VALUES ($1, $2, $3, true)
           RETURNING id, name as title, url as website_url, feed_url as url, category, active`,
          [title || rssFeedUrl, websiteUrl, rssFeedUrl]
        );
        return new Response(JSON.stringify(result.rows[0]), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: 'Source feed URL already exists' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw error;
      }
    }

    if (request.method === 'PUT') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { active, title, category } = body;
      const updates = [];
      const params = [id];
      let p = 2;

      if (active !== undefined) { updates.push(`active = $${p}`); params.push(active); p++; }
      if (title !== undefined) { updates.push(`name = $${p}`); params.push(title); p++; }
      if (category !== undefined) { updates.push(`category = $${p}`); params.push(category); p++; }

      if (!updates.length) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await query(
        `UPDATE sources SET ${updates.join(', ')} WHERE id = $1
         RETURNING id, name as title, url as website_url, feed_url as url, category, active`,
        params
      );

      if (!result.rows.length) {
        return new Response(JSON.stringify({ error: 'Source not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(result.rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'DELETE') {
      if (!id) {
        return new Response(JSON.stringify({ error: 'ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Delete articles first, then the source (no transaction needed with sequential queries)
      await query('DELETE FROM articles WHERE source_id = $1', [id]);
      const result = await query('DELETE FROM sources WHERE id = $1 RETURNING id', [id]);

      if (!result.rows.length) {
        return new Response(JSON.stringify({ error: 'Source not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ deleted: true, id: result.rows[0].id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    await logError('/api/sources', error, error.stack);
    console.error('Error processing sources:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default withCors(withAuth(handler));