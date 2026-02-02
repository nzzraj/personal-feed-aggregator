const express = require('express');
const Parser = require('rss-parser');
const { Pool } = require('pg');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const parser = new Parser({
  customFields: {
    item: ['media:content', 'content:encoded', 'description']
  }
});
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// RSS FEED FETCHING
// ==========================================

// Fetch and parse RSS feed
async function fetchFeed(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return {
      title: feed.title,
      description: feed.description,
      link: feed.link,
      items: feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        content: item.contentSnippet || item.content || item.description || '',
        creator: item.creator || item['dc:creator'] || feed.title,
        categories: item.categories || []
      }))
    };
  } catch (error) {
    console.error(`Error fetching feed ${feedUrl}:`, error.message);
    return null;
  }
}

// Fetch all feeds and store articles
async function fetchAllFeeds() {
  try {
    console.log('🔄 Fetching all feeds...');
    
    // Get all sources from database
    const sourcesResult = await pool.query('SELECT * FROM sources WHERE active = true');
    const sources = sourcesResult.rows;

    let totalNew = 0;

    for (const source of sources) {
      try {
        const feed = await fetchFeed(source.feed_url);
        
        if (!feed) {
          console.log(`⚠️  Failed to fetch: ${source.name}`);
          continue;
        }

        console.log(`✓ Fetched ${feed.items.length} items from ${source.name}`);

        // Store articles in database
        for (const item of feed.items) {
          try {
            // Check if article already exists
            const existingArticle = await pool.query(
              'SELECT id FROM articles WHERE url = $1',
              [item.link]
            );

            if (existingArticle.rows.length === 0) {
              // Insert new article
              await pool.query(
                `INSERT INTO articles (
                  source_id, title, url, excerpt, content, 
                  pub_date, author, tags
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  source.id,
                  item.title,
                  item.link,
                  item.content.substring(0, 300),
                  item.content,
                  item.pubDate,
                  item.creator,
                  item.categories
                ]
              );
              totalNew++;
            }
          } catch (err) {
            console.error(`Error storing article: ${item.title}`, err.message);
          }
        }

        // Update source last_fetched timestamp
        await pool.query(
          'UPDATE sources SET last_fetched = NOW() WHERE id = $1',
          [source.id]
        );

      } catch (err) {
        console.error(`Error processing source ${source.name}:`, err.message);
      }
    }

    console.log(`✅ Fetch complete! Added ${totalNew} new articles`);
    return { success: true, newArticles: totalNew };

  } catch (error) {
    console.error('Error in fetchAllFeeds:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Personal Feed Aggregator API',
    status: 'running',
    endpoints: {
      articles: '/api/articles',
      sources: '/api/sources',
      refresh: '/api/refresh'
    }
  });
});

// Get all articles (with filters)
app.get('/api/articles', async (req, res) => {
  try {
    const { source_id, unread, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        a.*,
        s.name as source_name,
        s.url as source_url,
        s.favicon as source_favicon
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (source_id) {
      query += ` AND a.source_id = $${paramCount}`;
      params.push(source_id);
      paramCount++;
    }

    if (unread === 'true') {
      query += ` AND a.read = false`;
    }

    query += ` ORDER BY a.pub_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Get single article
app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
        a.*,
        s.name as source_name,
        s.url as source_url,
        s.favicon as source_favicon
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching article:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Mark article as read
app.post('/api/articles/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE articles SET read = true WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking article as read:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Get all sources
app.get('/api/sources', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sources ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sources:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Add new source
app.post('/api/sources', async (req, res) => {
  try {
    const { name, url, feed_url, category } = req.body;
    
    if (!name || !feed_url) {
      return res.status(400).json({ error: 'Name and feed_url are required' });
    }

    // Try to fetch the feed to validate
    const feed = await fetchFeed(feed_url);
    if (!feed) {
      return res.status(400).json({ error: 'Invalid RSS feed URL' });
    }

    // Get favicon
    const favicon = `https://www.google.com/s2/favicons?domain=${url || feed_url}&sz=32`;

    const result = await pool.query(
      `INSERT INTO sources (name, url, feed_url, category, favicon, active) 
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [name, url || feed.link, feed_url, category, favicon]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding source:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Delete source
app.delete('/api/sources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete associated articles first
    await pool.query('DELETE FROM articles WHERE source_id = $1', [id]);
    
    // Delete source
    const result = await pool.query('DELETE FROM sources WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }
    
    res.json({ message: 'Source deleted successfully', source: result.rows[0] });
  } catch (err) {
    console.error('Error deleting source:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Manual refresh endpoint
app.post('/api/refresh', async (req, res) => {
  try {
    const result = await fetchAllFeeds();
    res.json(result);
  } catch (err) {
    console.error('Error refreshing feeds:', err);
    res.status(500).json({ error: 'Refresh failed', message: err.message });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const [totalArticles, unreadArticles, totalSources] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM articles'),
      pool.query('SELECT COUNT(*) FROM articles WHERE read = false'),
      pool.query('SELECT COUNT(*) FROM sources WHERE active = true')
    ]);

    res.json({
      totalArticles: parseInt(totalArticles.rows[0].count),
      unreadArticles: parseInt(unreadArticles.rows[0].count),
      totalSources: parseInt(totalSources.rows[0].count)
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// Search articles
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await pool.query(
      `SELECT 
        a.*,
        s.name as source_name,
        s.url as source_url,
        s.favicon as source_favicon
      FROM articles a
      JOIN sources s ON a.source_id = s.id
      WHERE 
        a.title ILIKE $1 OR 
        a.excerpt ILIKE $1 OR 
        a.content ILIKE $1
      ORDER BY a.pub_date DESC
      LIMIT 50`,
      [`%${q}%`]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error searching articles:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// ==========================================
// SCHEDULED TASKS
// ==========================================

// Fetch feeds every hour
cron.schedule('0 * * * *', () => {
  console.log('🕐 Running scheduled feed fetch...');
  fetchAllFeeds();
});

// ==========================================
// START SERVER
// ==========================================

app.listen(port, () => {
  console.log(`🚀 Personal Feed Aggregator API running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Fetch feeds on startup
  setTimeout(() => {
    console.log('📥 Performing initial feed fetch...');
    fetchAllFeeds();
  }, 2000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
