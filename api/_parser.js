const Parser = require('rss-parser');

const parser = new Parser({
  customFields: {
    item: ['media:content', 'content:encoded', 'description']
  }
});

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

module.exports = { fetchFeed };