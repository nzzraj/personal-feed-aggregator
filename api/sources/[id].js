const { getPool } = require('../_db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    const pool = getPool();

    if (req.method === 'GET') {
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
      
      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const result = await pool.query(
        'UPDATE articles SET read = true WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Article not found' });
      }
      
      return res.status(200).json(result.rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error processing article:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
};
