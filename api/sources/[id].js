const { getPool } = require('../_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    const pool = getPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT * FROM sources WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Source not found' });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'PUT') {
      const { name, url, feed_url, active } = req.body;
      const result = await pool.query(
        `UPDATE sources 
         SET name = COALESCE($1, name),
             url = COALESCE($2, url),
             feed_url = COALESCE($3, feed_url),
             active = COALESCE($4, active)
         WHERE id = $5
         RETURNING *`,
        [name, url, feed_url, active, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Source not found' });
      }

      return res.status(200).json(result.rows[0]);
    }

    if (req.method === 'DELETE') {
      // Delete articles first due to FK constraint
      await pool.query('DELETE FROM articles WHERE source_id = $1', [id]);
      const result = await pool.query(
        'DELETE FROM sources WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Source not found' });
      }

      return res.status(200).json({ message: 'Source deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Error processing source:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
};
