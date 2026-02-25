const { getPool } = require('./_db');
const { fetchFeed } = require('./_parser');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();

    const sourcesResult = await pool.query(
      'SELECT * FROM sources WHERE active = true'
    );
    const sources = sourcesResult.rows;

    let totalArticles = 0;
    let successfulFeeds = 0;

    for (const source of sources) {
      try {
        const feedData = await fetchFeed(source.feed_url);

        if (!feedData) {
          console.log(`Failed to fetch feed: ${source.name}`);
          continue;
        }

        successfulFeeds++;

        for (const item of feedData.items) {
          try {
            if (!item.url) continue;

            // Check if article already exists by URL
            const existing = await pool.query(
              'SELECT id FROM articles WHERE url = $1',
              [item.url]
            );

            if (existing.rows.length === 0) {
              await pool.query(
                `INSERT INTO articles (source_id, title, url, pub_date, content, author)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                  source.id,
                  item.title,
                  item.url,
                  item.pubDate,
                  item.content,
                  item.creator
                ]
              );
              totalArticles++;
            }
          } catch (err) {
            console.error(`Error inserting article: ${item.title}`, err.message);
          }
        }

        await pool.query(
          'UPDATE sources SET last_fetched = NOW() WHERE id = $1',
          [source.id]
        );

      } catch (err) {
        console.error(`Error processing feed ${source.name}:`, err.message);
      }
    }

    res.status(200).json({
      message: 'Feeds refreshed successfully',
      totalFeeds: sources.length,
      successfulFeeds,
      newArticles: totalArticles
    });

  } catch (err) {
    console.error('Error refreshing feeds:', err);
    res.status(500).json({ error: 'Error refreshing feeds', message: err.message });
  }
};
