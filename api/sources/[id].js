// Re-export the same handler — Vercel will route /api/sources/[id] here
// The handler reads the ID from the URL path itself
export { default } from '../sources.js';