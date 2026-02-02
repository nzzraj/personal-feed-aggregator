const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function initDatabase() {
  try {
    console.log('🔧 Initializing database...');

    // Create sources table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sources (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT,
        feed_url TEXT NOT NULL UNIQUE,
        category TEXT,
        favicon TEXT,
        active BOOLEAN DEFAULT true,
        last_fetched TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `);
    console.log('✅ Sources table created');

    // Create articles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT REFERENCES sources(id),
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT,
        pub_date TIMESTAMP WITH TIME ZONE,
        author TEXT,
        tags TEXT[],
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `);
    console.log('✅ Articles table created');

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
      CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
      CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(read);
      CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
      CREATE INDEX IF NOT EXISTS idx_sources_feed_url ON sources(feed_url);
    `);
    console.log('✅ Indexes created');

    // Insert default sources (popular tech/indie blogs)
    const defaultSources = [
      {
        name: "Paul Graham",
        url: "http://www.paulgraham.com/",
        feed_url: "http://www.paulgraham.com/rss.html",
        category: "startup",
        favicon: "http://www.paulgraham.com/favicon.ico"
      },
      {
        name: "Wait But Why",
        url: "https://waitbutwhy.com",
        feed_url: "https://waitbutwhy.com/feed",
        category: "blog",
        favicon: "https://waitbutwhy.com/favicon.ico"
      },
      {
        name: "Stratechery",
        url: "https://stratechery.com",
        feed_url: "https://stratechery.com/feed",
        category: "tech",
        favicon: "https://stratechery.com/favicon.ico"
      },
      {
        name: "Hacker News",
        url: "https://news.ycombinator.com",
        feed_url: "https://news.ycombinator.com/rss",
        category: "tech",
        favicon: "https://news.ycombinator.com/favicon.ico"
      },
      {
        name: "The Marginalian (Brain Pickings)",
        url: "https://www.themarginalian.org",
        feed_url: "https://www.themarginalian.org/feed/",
        category: "culture",
        favicon: "https://www.themarginalian.org/favicon.ico"
      },
      {
        name: "Daring Fireball",
        url: "https://daringfireball.net",
        feed_url: "https://daringfireball.net/feeds/main",
        category: "tech",
        favicon: "https://daringfireball.net/favicon.ico"
      },
      {
        name: "Seth's Blog",
        url: "https://seths.blog",
        feed_url: "https://seths.blog/feed/atom/",
        category: "marketing",
        favicon: "https://seths.blog/favicon.ico"
      },
      {
        name: "Joel on Software",
        url: "https://www.joelonsoftware.com",
        feed_url: "https://www.joelonsoftware.com/feed/",
        category: "programming",
        favicon: "https://www.joelonsoftware.com/favicon.ico"
      },
      {
        name: "Farnam Street",
        url: "https://fs.blog",
        feed_url: "https://fs.blog/feed/",
        category: "thinking",
        favicon: "https://fs.blog/favicon.ico"
      },
      {
        name: "Indie Hackers",
        url: "https://www.indiehackers.com",
        feed_url: "https://www.indiehackers.com/feed",
        category: "startup",
        favicon: "https://www.indiehackers.com/favicon.ico"
      }
    ];

    for (const source of defaultSources) {
      await pool.query(
        `INSERT INTO sources (name, url, feed_url, category, favicon) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (feed_url) DO NOTHING`,
        [source.name, source.url, source.feed_url, source.category, source.favicon]
      );
    }
    console.log('✅ Default sources inserted');

    console.log('🎉 Database initialization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Start the server: npm start');
    console.log('2. The server will automatically fetch feeds on startup');
    console.log('3. Feeds will refresh automatically every hour');
    console.log('4. Or manually refresh: POST to /api/refresh\n');
    
  } catch (err) {
    console.error('❌ Error initializing database:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

// Run initialization
initDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
