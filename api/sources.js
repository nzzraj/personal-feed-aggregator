const { getPool } = require('./_db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pool = getPool();

  try {
    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM sources ORDER BY name'
      );
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const { name, feed_url, url } = req.body;

      if (!name || !feed_url) {
        return res.status(400).json({ error: 'Name and feed_url are required' });
      }

      // Extract favicon
      let favicon = '';
      if (url) {
        try {
          const urlObj = new URL(url);
          favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        } catch (e) {
          console.error('Error parsing URL for favicon:', e);
        }
      }

      const result = await pool.query(
        `INSERT INTO sources (name, url, feed_url, favicon, active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [name, url || feed_url, feed_url, favicon]
      );

      return res.status(201).json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error processing sources:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
};
