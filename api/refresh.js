import { query } from './_db.js';
import { withCors } from './_cors.js';
import { withAuth } from './_auth.js';
import { logError } from './_logger.js';
import { parseFeed } from './_parser.js';

async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();

  try {
    // FIX: Select feed_url (the actual RSS URL) not url (the website homepage)
    const sourcesResult = await query(
      'SELECT id, feed_url, name FROM sources WHERE active = true ORDER BY name'
    );

    const sources = sourcesResult.rows;

    if (sources.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No active sources to refresh',
          duration: Date.now() - startTime
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      articlesInserted: 0,
      articlesSkipped: 0,
      feeds: []
    };

    const feedPromises = sources.map(async (source) => {
      try {
        // FIX: use feed_url (RSS endpoint), not url (website homepage)
        const parsed = await parseFeed(source.feed_url);

        if (!parsed.success) {
          await logError(
            '/api/refresh',
            new Error(`Feed parse failed: ${source.name}`),
            parsed.error
          );
          results.failed++;
          results.feeds.push({
            source: source.name,
            success: false,
            error: parsed.error
          });
          return null;
        }

        if (parsed.articles.length === 0) {
          results.success++;
          results.feeds.push({
            source: source.name,
            success: true,
            articlesFound: 0,
            articlesInserted: 0
          });
          return null;
        }

        const insertResult = await bulkInsertArticles(source.id, parsed.articles);

        results.success++;
        results.articlesInserted += insertResult.inserted;
        results.articlesSkipped += insertResult.skipped;

        results.feeds.push({
          source: source.name,
          success: true,
          articlesFound: parsed.articles.length,
          articlesInserted: insertResult.inserted,
          articlesSkipped: insertResult.skipped
        });

        return null;
      } catch (error) {
        console.error(`Error fetching ${source.name}:`, error);
        await logError(
          '/api/refresh',
          new Error(`Feed fetch failed: ${source.name}`),
          error.stack
        );
        results.failed++;
        results.feeds.push({
          source: source.name,
          success: false,
          error: error.message
        });
        return null;
      }
    });

    await Promise.allSettled(feedPromises);

    return new Response(
      JSON.stringify({
        ...results,
        duration: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await logError('/api/refresh', error, error.stack);
    console.error('Refresh error:', error);

    return new Response(
      JSON.stringify({
        error: 'Refresh failed',
        message: error.message,
        duration: `${Date.now() - startTime}ms`
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function bulkInsertArticles(sourceId, articles) {
  if (articles.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  try {
    const values = articles
      .map((_, i) => {
        const b = i * 8;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
      })
      .join(', ');

    const params = [];
    articles.forEach((article) => {
      params.push(
        sourceId,
        article.title,
        article.url,
        article.content,
        article.excerpt,
        article.pub_date,
        article.content_hash,
        article.read_time_minutes
      );
    });

    const result = await query(
      `INSERT INTO articles 
       (source_id, title, url, content, excerpt, pub_date, content_hash, read_time_minutes)
       VALUES ${values}
       ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      params
    );

    return {
      inserted: result.rows.length,
      skipped: articles.length - result.rows.length
    };
  } catch (error) {
    console.error('Bulk insert error, falling back to individual inserts:', error);
    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        const result = await query(
          `INSERT INTO articles 
           (source_id, title, url, content, excerpt, pub_date, content_hash, read_time_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (content_hash) DO UPDATE SET updated_at = NOW()
           RETURNING id`,
          [
            sourceId, article.title, article.url, article.content,
            article.excerpt, article.pub_date, article.content_hash, article.read_time_minutes
          ]
        );
        if (result.rows.length > 0) inserted++;
        else skipped++;
      } catch (insertError) {
        console.error('Individual insert failed:', insertError);
        skipped++;
      }
    }

    return { inserted, skipped };
  }
}

export default withCors(withAuth(handler));