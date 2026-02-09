const { getPool } = require('./_db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pool = getPool();
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
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
};