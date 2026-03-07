import crypto from 'crypto';
import Parser from 'rss-parser';

const parser = new Parser({
  customFields: {
    item: [['content:encoded', 'fullContent']]
  }
});

export function generateContentHash(title, content) {
  const text = `${title}|${content}`.trim();
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function validatePublicationDate(pubDate, fallbackDate = null) {
  if (pubDate) {
    const parsed = new Date(pubDate);
    if (!isNaN(parsed.getTime()) && parsed <= new Date()) {
      return parsed;
    }
  }
  if (fallbackDate) return fallbackDate;
  return null;
}

export async function parseFeed(feedUrl) {
  const discoveryTime = new Date();
  try {
    const feed = await parser.parseURL(feedUrl);
    const articles = feed.items.map((item) => {
      const content = item.fullContent || item.content || item.contentSnippet || item.summary || '';
      const plainText = content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      const wordCount = plainText.split(/\s+/).length;
      const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
      const pubDate = validatePublicationDate(item.pubDate, discoveryTime);
      if (!pubDate) {
        console.warn(`Skipping article with invalid date: "${item.title}" from ${feedUrl}`);
        return null;
      }
      const contentHash = generateContentHash(item.title || '', content.substring(0, 500));
      return {
        title: item.title || '(Untitled)',
        url: item.link || '',
        content: content.substring(0, 10000),
        excerpt: plainText.substring(0, 200),
        pub_date: pubDate,
        content_hash: contentHash,
        word_count: wordCount,
        read_time_minutes: readTimeMinutes,
        discovered_at: discoveryTime
      };
    }).filter(Boolean);

    return {
      success: true,
      articles,
      parsedCount: articles.length,
      totalCount: feed.items.length,
      skippedCount: feed.items.length - articles.length
    };
  } catch (error) {
    console.error(`Failed to parse feed: ${feedUrl}`, error);
    return { success: false, articles: [], error: error.message };
  }
}