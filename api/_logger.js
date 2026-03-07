import { query } from './_db.js';

export async function logError(endpoint, error, stackTrace = '') {
  try {
    await query(
      `INSERT INTO errors (api_endpoint, error_message, stack_trace, created_at) VALUES ($1, $2, $3, NOW())`,
      [endpoint, error?.message || String(error), stackTrace || (error?.stack || '')]
    );
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

export function withErrorLogging(endpoint, handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      await logError(endpoint, error, error.stack);
      console.error(`${endpoint} error:`, error);
      return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}