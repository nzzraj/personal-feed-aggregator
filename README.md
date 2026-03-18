# My Reading Feed

A personal RSS reader — clean, fast, and minimal. Built for one user who wants full control over what they read.

Live at [myreadfeed.vercel.app](https://myreadfeed.vercel.app)

---

## What it does

- Aggregates RSS feeds from curated sources into a single reading view
- Filters by All / Unread / Today / This Week, or by source
- Marks articles as read when you open them
- Refresh feeds on demand
- Add and remove sources from the UI
- PWA — installable on mobile and desktop
- Dark mode

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single `index.html` |
| Backend | Vercel Serverless Functions (Node.js) |
| Database | Supabase (PostgreSQL) |
| Auth | JWT — password-protected admin mode |
| Hosting | Vercel |

---

## Project structure

```
├── index.html           — full frontend (UI, state, API calls)
├── vercel.json          — function timeout config
├── manifest.json        — PWA manifest
├── sw.js                — service worker
├── icon-192.png         — PWA icon
├── icon-512.png         — PWA icon
└── api/
    ├── _cors.js         — CORS headers + request normalization
    ├── _db.js           — PostgreSQL connection pool
    ├── _jwt.js          — JWT sign/verify (no dependencies)
    ├── _auth.js         — auth middleware for write endpoints
    ├── _logger.js       — error logging to DB
    ├── auth.js          — POST /api/auth
    ├── articles.js      — GET /api/articles
    ├── articles/
    │   └── [id].js      — PUT /api/articles/:id (mark read)
    ├── sources.js       — GET, POST /api/sources
    ├── sources/
    │   └── [id].js      — DELETE /api/sources/:id
    ├── refresh.js       — POST /api/refresh (fetch all feeds)
    ├── search.js        — GET /api/search
    ├── health.js        — GET /api/health
    └── errors.js        — GET /api/errors
```

---

## Database schema

Three tables in Supabase:

```sql
sources   — id, name, feed_url, url, category, active, last_fetched
articles  — id, source_id, title, url, excerpt, pub_date, read, saved
errors    — id, api_endpoint, error_message, stack_trace, created_at
```

---

## Environment variables

Set these in Vercel project settings:

```
DATABASE_URL      — Supabase transaction pooler connection string
API_KEY           — internal key for refresh endpoint
ADMIN_PASSWORD    — password for admin login
JWT_SECRET        — secret for signing JWT tokens
```

---

## Auth

Write operations (add/delete sources, refresh feeds) require admin login.

- Desktop: `Shift+A` to open login modal
- Mobile: Admin button in the bottom nav
- Token stored in `localStorage`, expires after 8 hours
- No user accounts — single password, single owner

---

## Local dev

No build step. Open `index.html` directly in a browser for the frontend.

For the API, deploy to Vercel or run locally with the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

Set your environment variables in a `.env.local` file or via `vercel env pull`.
