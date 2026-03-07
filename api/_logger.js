import { pool } from './_db.js';

/**
 * Log errors to the _errors table for debugging and monitoring
 */
export async function logError(endpoint, error, stackTrace = '') {
  try {
    await pool.query(
      `INSERT INTO errors (api_endpoint, error_message, stack_trace, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        endpoint,
        error?.message || String(error),
        stackTrace || (error?.stack || '')
      ]
    );
  } catch (logError) {
    // Fail silently if logging fails — don't break the API
    console.error('Failed to log error:', logError);
  }
}

/**
 * Wrap an async handler to automatically log errors
 * Usage: export default withErrorLogging('/api/refresh', handler);
 */
export function withErrorLogging(endpoint, handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      await logError(endpoint, error, error.stack);
      console.error(`${endpoint} error:`, error);
      
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error.message
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Get recent errors (admin endpoint - requires API key)
 * Useful for debugging: GET /api/errors?limit=50
 */
export async function getErrors(limit = 50) {
  try {
    const result = await pool.query(
      `SELECT * FROM errors 
       ORDER BY created_at DESC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch errors:', error);
    return [];
  }
}

/**
 * Clear old errors (keep last 7 days)
 * Call this periodically via cron
 */
export async function cleanupOldErrors(daysToKeep = 7) {
  try {
    const result = await pool.query(
      `DELETE FROM errors 
       WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
    );
    console.log(`Cleaned up ${result.rowCount} old error logs`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to cleanup errors:', error);
  }
}
