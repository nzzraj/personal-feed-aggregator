const { Pool } = require('pg');

// Serverless-safe: limit to 1 connection per function instance.
// Vercel spins up many instances — keeping this at 1 prevents
// blowing past Supabase free tier's 60 connection limit.
let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,              // 1 connection per serverless instance
      idleTimeoutMillis: 10000,   // release idle connections after 10s
      connectionTimeoutMillis: 10000, // fail fast if can't connect
    });

    // Log and handle unexpected pool errors (prevents unhandled rejections)
    pool.on('error', (err) => {
      console.error('DB pool error:', err.message);
      pool = null; // reset so next request gets a fresh pool
    });
  }
  return pool;
}

module.exports = { getPool };