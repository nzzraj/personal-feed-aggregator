import { query } from '../_db.js';
import { withCors } from '../_cors.js';
import { withAuth } from '../_auth.js';
import { logError } from '../_logger.js';
import { parseFeed } from '../_parser.js';

async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();

  try {
    // Get all active sources
    const sourcesResult = await query(
      'SELECT id, url, title FROM sources WHERE active = true ORDER BY title'
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

    // Fetch all feeds in parallel
    const feedPromises = sources.map(async (source) => {
      try {
        const parsed = await parseFeed(source.url);
        
        if (!parsed.success) {
          await logError(
            '/api/refresh',
            new Error(`Feed parse failed: ${source.title}`),
            parsed.error
          );
          results.failed++;
          return {
            source: source.title,
            success: false,
            error: parsed.error
          };
        }

        if (parsed.articles.length === 0) {
          results.feeds.push({
            source: source.title,
            success: true,
            articlesFound: 0,
            articlesInserted: 0
          });
          return null;
        }

        // Bulk insert with deduplication
        // Use ON CONFLICT DO UPDATE so duplicates are skipped silently
        const insertResult = await bulkInsertArticles(
          source.id,
          parsed.articles
        );

        results.success++;
        results.articlesInserted += insertResult.inserted;
        results.articlesSkipped += insertResult.skipped;

        results.feeds.push({
          source: source.title,
          success: true,
          articlesFound: parsed.articles.length,
          articlesInserted: insertResult.inserted,
          articlesSkipped: insertResult.skipped
        });

        return null;
      } catch (error) {
        console.error(`Error fetching ${source.title}:`, error);
        await logError(
          '/api/refresh',
          new Error(`Feed fetch failed: ${source.title}`),
          error.stack
        );
        results.failed++;
        results.feeds.push({
          source: source.title,
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

/**
 * Bulk insert articles with deduplication
 * Returns { inserted: count, skipped: count }
 */
async function bulkInsertArticles(sourceId, articles) {
  if (articles.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  try {
    // Build a VALUES clause for all articles at once
    const values = articles
      .map((_, i) => {
        const baseIdx = i * 8;
        return `(
          $${baseIdx + 1},
          $${baseIdx + 2},
          $${baseIdx + 3},
          $${baseIdx + 4},
          $${baseIdx + 5},
          $${baseIdx + 6},
          $${baseIdx + 7},
          $${baseIdx + 8}
        )`;
      })
      .join(', ');

    // Flatten all parameters
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
       ON CONFLICT (content_hash) DO UPDATE SET
         updated_at = NOW()
       RETURNING id`,
      params
    );

    // inserted = new rows, skipped = duplicate content_hashes
    return {
      inserted: result.rows.length,
      skipped: articles.length - result.rows.length
    };
  } catch (error) {
    console.error('Bulk insert error:', error);
    // Fall back to individual inserts on error
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
            sourceId,
            article.title,
            article.url,
            article.content,
            article.excerpt,
            article.pub_date,
            article.content_hash,
            article.read_time_minutes
          ]
        );
        if (result.rows.length > 0) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (insertError) {
        console.error('Individual insert failed:', insertError);
        skipped++;
      }
    }

    return { inserted, skipped };
  }
}

export default withCors(withAuth(handler));
