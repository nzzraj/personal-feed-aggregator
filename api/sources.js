import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';

async function handler(request) {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathParts = url.pathname.split('/').filter(Boolean);
    // ['api', 'sources'] or ['api', 'sources', '123']
    const id = pathParts.length >= 3 ? pathParts[2] : null;

    // ── GET ──────────────────────────────────────────────────────────────────
    if (request.method === 'GET') {
      const baseSelect = `
        SELECT
          s.id,
          s.name       AS title,
          s.url        AS website_url,
          s.feed_url   AS url,
          COALESCE(s.category, 'Uncategorized') AS category,
          COALESCE(s.active, true)              AS active,
          COUNT(a.id)                                         AS total_articles,
          COUNT(CASE WHEN a.read = false THEN 1 END)          AS unread_count
        FROM sources s
        LEFT JOIN articles a ON s.id = a.source_id
      `;

      if (id) {
        const result = await query(
          baseSelect + ' WHERE s.id = $1 GROUP BY s.id, s.name, s.url, s.feed_url, s.category, s.active',
          [id]
        );
        if (!result.rows.length) {
          return new Response(JSON.stringify({ error: 'Source not found' }), { status: 404 });
        }
        return new Response(JSON.stringify(result.rows[0]), { status: 200 });
      }

      const result = await query(
        baseSelect + ' GROUP BY s.id, s.name, s.url, s.feed_url, s.category, s.active ORDER BY COALESCE(s.name, s.feed_url)'
      );
      return new Response(JSON.stringify(result.rows), { status: 200 });
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (request.method === 'POST') {
      const body = await request.json();
      const { title, url: bodyUrl, feedUrl, feed_url } = body;

      const rssFeedUrl = feedUrl || feed_url || bodyUrl;
      if (!rssFeedUrl) {
        return new Response(JSON.stringify({ error: 'RSS feed URL is required' }), { status: 400 });
      }

      const websiteUrl = (bodyUrl && bodyUrl !== rssFeedUrl) ? bodyUrl : rssFeedUrl;
      const sourceName = title || rssFeedUrl;

      // Use INSERT ... ON CONFLICT so duplicate feed_url returns the existing row
      // instead of throwing a unique-constraint error.
      const result = await query(
        `INSERT INTO sources (name, url, feed_url, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (feed_url) DO UPDATE
           SET name = EXCLUDED.name,
               url  = EXCLUDED.url
         RETURNING id, name AS title, url AS website_url, feed_url AS url, category, active`,
        [sourceName, websiteUrl, rssFeedUrl]
      );

      return new Response(JSON.stringify(result.rows[0]), { status: 201 });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (request.method === 'PUT') {
      if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400 });

      const body = await request.json();
      const { active, title, category } = body;
      const updates = [];
      const params = [id];
      let p = 2;

      if (active   !== undefined) { updates.push(`active   = $${p}`); params.push(active);   p++; }
      if (title    !== undefined) { updates.push(`name     = $${p}`); params.push(title);    p++; }
      if (category !== undefined) { updates.push(`category = $${p}`); params.push(category); p++; }

      if (!updates.length) return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 });

      const result = await query(
        `UPDATE sources SET ${updates.join(', ')} WHERE id = $1
         RETURNING id, name AS title, url AS website_url, feed_url AS url, category, active`,
        params
      );

      if (!result.rows.length) return new Response(JSON.stringify({ error: 'Source not found' }), { status: 404 });
      return new Response(JSON.stringify(result.rows[0]), { status: 200 });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (request.method === 'DELETE') {
      if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400 });

      await query('DELETE FROM articles WHERE source_id = $1', [id]);
      const result = await query('DELETE FROM sources WHERE id = $1 RETURNING id', [id]);

      if (!result.rows.length) return new Response(JSON.stringify({ error: 'Source not found' }), { status: 404 });
      return new Response(JSON.stringify({ deleted: true, id: result.rows[0].id }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  } catch (error) {
    await logError('/api/sources', error, error.stack);
    console.error('Error processing sources:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: error.message }), { status: 500 });
  }
}

export default withCors(withAuth(handler));