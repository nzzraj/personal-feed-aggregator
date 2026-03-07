-- Feed Aggregator Database Migration
-- Run this in Supabase SQL Editor to set up the complete schema

-- Create errors table for logging
CREATE TABLE IF NOT EXISTS errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint VARCHAR(256) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_errors_endpoint ON errors(api_endpoint);
CREATE INDEX IF NOT EXISTS idx_errors_created_at ON errors(created_at);

-- Add missing columns to sources table (only if they don't exist)
ALTER TABLE sources 
ADD COLUMN IF NOT EXISTS last_fetch_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS etag VARCHAR(256);

-- Check if sources table has all required columns, add them if missing
-- Some versions might have different schema
ALTER TABLE sources
ADD COLUMN IF NOT EXISTS title VARCHAR(256),
ADD COLUMN IF NOT EXISTS category VARCHAR(128);

-- Add missing columns to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS read_time_minutes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS saved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create unique index on content_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);

-- Create index for full-text search performance
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);
CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_pub_date ON articles(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_read ON articles(read);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_articles_source_read ON articles(source_id, read);
CREATE INDEX IF NOT EXISTS idx_articles_read_date ON articles(read, pub_date DESC);

-- Update existing articles to have read_time_minutes calculated
UPDATE articles 
SET read_time_minutes = GREATEST(1, CEIL(COALESCE(word_count, 200) :: NUMERIC / 200))
WHERE read_time_minutes = 1 AND word_count > 0;

-- Add default sources if they don't exist (check by URL to avoid duplicates)
INSERT INTO sources (url, title, category) VALUES
  ('https://paulgraham.com/index.html', 'Paul Graham', 'Essays'),
  ('https://news.ycombinator.com/rss', 'Hacker News', 'News'),
  ('https://fermatslibrary.com/rss.xml', 'Fermat''s Library', 'Science'),
  ('https://farnamstreetblog.com/feed/', 'Farnam Street', 'Learning'),
  ('https://xkcd.com/rss.xml', 'XKCD', 'Humor'),
  ('https://www.scribd.com/feed', 'Scribd', 'Articles'),
  ('https://www.ycharts.com/feed/updates', 'Y Charts', 'Finance'),
  ('https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica', 'Tech'),
  ('https://www.anthropic.com/feed.xml', 'Anthropic', 'AI'),
  ('https://openai.com/blog/feed.xml', 'OpenAI', 'AI')
ON CONFLICT (url) DO NOTHING;

-- Create a cleanup function for old articles (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_old_articles(days_to_keep INTEGER = 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM articles 
  WHERE pub_date < NOW() - MAKE_INTERVAL(days => days_to_keep)
    AND read = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update read_time_minutes (call after bulk insert)
CREATE OR REPLACE FUNCTION update_read_time()
RETURNS VOID AS $$
BEGIN
  UPDATE articles 
  SET read_time_minutes = GREATEST(1, CEIL(COALESCE(word_count, 0) :: NUMERIC / 200))
  WHERE read_time_minutes IS NULL OR read_time_minutes = 0;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT SELECT ON errors TO anon;
GRANT INSERT ON errors TO anon;
GRANT SELECT ON articles TO anon;
GRANT UPDATE ON articles TO anon;
GRANT SELECT ON sources TO anon;
GRANT INSERT ON sources TO anon;
GRANT UPDATE ON sources TO anon;
GRANT DELETE ON sources TO anon;
GRANT DELETE ON articles TO anon;

-- Print summary
SELECT 'Migration complete. Created/updated:' as status;
