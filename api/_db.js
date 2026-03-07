import pg from 'pg';

const { Pool } = pg;

// Validate DATABASE_URL on startup
if (!process.env.DATABASE_URL) {
  const errorMsg = `
    ❌ DATABASE_URL environment variable is not set.
    
    This is required for the API to connect to Supabase.
    
    1. Go to Supabase → Project Settings → Database
    2. Copy the "Connection string (URI)" from "Connection pooling"
    3. Add it to Vercel → Project Settings → Environment Variables
    
    Format should be:
    postgresql://postgres.XXXX:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
    
    Key: DATABASE_URL
  `;
  console.error(errorMsg);
  process.exit(1);
}

// Create connection pool with optimized settings
let pool = null;

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, // Limit to 1 connection per serverless instance to avoid exceeding Supabase's limit
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Don't wait indefinitely for connections
    statement_timeout: 30000, // 30 second timeout per query
    idle_in_transaction_session_timeout: 10000
  });
}

// Initialize pool with error handling
pool = createPool();

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't set pool = null here; let the next query attempt a fresh connection
  // This prevents reconnection storms under burst errors
});

pool.on('connect', () => {
  console.log('Connected to Supabase');
});

// Expose query function
export async function query(sql, params) {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    console.error('Query error:', {
      message: error.message,
      sql: sql.substring(0, 100), // Log first 100 chars of query
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Health check
export async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW()');
    return {
      ok: true,
      timestamp: result.rows[0].now
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

// Graceful shutdown
export async function shutdown() {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
  }
}

export { pool };
