import crypto from 'crypto';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'fullContent']]
  }
});

/**
 * Generate SHA-256 hash of article content for deduplication
 */
export function generateContentHash(title, content) {
  const text = `${title}|${content}`.trim();
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
}

/**
 * Validate and normalize a publication date
 * Returns timestamp or null if invalid
 */
export function validatePublicationDate(pubDate, fallbackDate = null) {
  // Try to parse the provided date
  if (pubDate) {
    const parsed = new Date(pubDate);
    
    // Check if it's a valid date and not in the future
    if (!isNaN(parsed.getTime()) && parsed <= new Date()) {
      return parsed;
    }
  }

  // Use fallback (discovery date) if provided
  if (fallbackDate) {
    return fallbackDate;
  }

  // Last resort: never use NOW() — return null and skip this article
  // This prevents fresh articles from appearing at the top due to parsing errors
  return null;
}

/**
 * Parse a single feed and return normalized articles
 */
export async function parseFeed(feedUrl) {
  const discoveryTime = new Date(); // When we fetched this feed
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    const articles = feed.items.map((item) => {
      // Get content: prefer full content, fall back to summary
      const content = item.fullContent || item.content || item.contentSnippet || item.summary || '';
      
      // Extract plain text for read time calculation
      const plainText = content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      const wordCount = plainText.split(/\s+/).length;
      const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute

      // Validate publication date
      const pubDate = validatePublicationDate(item.pubDate, discoveryTime);
      
      // Skip articles with invalid dates
      if (!pubDate) {
        console.warn(`Skipping article with invalid date: "${item.title}" from ${feedUrl}`);
        return null;
      }

      // Generate content hash for deduplication
      const contentHash = generateContentHash(item.title || '', content.substring(0, 500));

      return {
        title: item.title || '(Untitled)',
        url: item.link || '',
        content: content.substring(0, 10000), // Cap content at 10KB
        excerpt: plainText.substring(0, 200), // First 200 chars of plain text
        pub_date: pubDate,
        content_hash: contentHash,
        word_count: wordCount,
        read_time_minutes: readTimeMinutes,
        discovered_at: discoveryTime
      };
    }).filter(Boolean); // Remove null entries (invalid dates)

    return {
      success: true,
      articles,
      parsedCount: articles.length,
      totalCount: feed.items.length,
      skippedCount: feed.items.length - articles.length
    };
  } catch (error) {
    console.error(`Failed to parse feed: ${feedUrl}`, error);
    return {
      success: false,
      articles: [],
      error: error.message
    };
  }
}

/**
 * Check if feed has been modified since last fetch (using ETags)
 * Returns { modified: boolean, etag: string|null }
 */
export async function checkFeedModified(feedUrl, lastEtag = null) {
  try {
    const response = await fetch(feedUrl, {
      method: 'HEAD',
      headers: lastEtag ? { 'If-None-Match': lastEtag } : {}
    });

    if (response.status === 304) {
      // Not modified
      return { modified: false, etag: lastEtag };
    }

    return {
      modified: true,
      etag: response.headers.get('etag') || null
    };
  } catch (error) {
    console.error(`Failed to check feed modification: ${feedUrl}`, error);
    // Assume modified if we can't check
    return { modified: true, etag: null };
  }
}
