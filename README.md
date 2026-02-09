# Personal Feed Aggregator - Vercel Migration

100% Free hosting with Vercel (API) + Netlify (Frontend) + Supabase (Database)

## 🏗️ Project Structure

```
personal-feed-aggregator/
├── api/                      # Vercel Serverless Functions
│   ├── _db.js               # Database connection utility
│   ├── _parser.js           # RSS parser utility
│   ├── articles.js          # GET /api/articles
│   ├── articles/
│   │   └── [id].js         # GET/PUT /api/articles/:id
│   ├── sources.js           # GET/POST /api/sources
│   ├── sources/
│   │   └── [id].js         # DELETE /api/sources/:id
│   └── refresh.js           # POST /api/refresh
├── index.html               # Frontend (deploy to Netlify)
├── init-db.js              # Database initialization script
├── vercel.json             # Vercel configuration
├── package.json            # Dependencies
├── .env                    # Environment variables (not in git)
├── .env.example            # Example env file
└── .gitignore              # Git ignore rules
```

## 📋 Prerequisites

- Node.js installed
- GitHub account
- Supabase account (free)
- Vercel account (free)
- Netlify account (free)

## 🚀 Step-by-Step Setup

### Step 1: Set Up Supabase Database

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in details:
   - Name: `personal-feed-aggregator`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Wait ~2 minutes for provisioning
5. Go to **Settings** → **Database**
6. Copy the **Connection String** (URI format)
7. Click "Show" to reveal the password placeholder

### Step 2: Initialize Database

1. Create `.env` file in your project root:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres
NODE_ENV=production
```

2. Replace `[YOUR-PASSWORD]` and `[YOUR-REF]` with your Supabase credentials

3. Install dependencies:
```bash
npm install
```

4. Run database initialization:
```bash
node init-db.js
```

You should see:
```
✅ Sources table created
✅ Articles table created
✅ Indexes created
✅ Default sources inserted
🎉 Database initialization complete!
```

### Step 3: Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy to preview:
```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **personal-feed-aggregator** (or your choice)
- In which directory is your code? **./**
- Want to modify settings? **N**

4. Add environment variables in Vercel:
   - Go to https://vercel.com/dashboard
   - Select your project
   - Go to **Settings** → **Environment Variables**
   - Add:
     - `DATABASE_URL`: Your Supabase connection string
     - `NODE_ENV`: `production`

5. Deploy to production:
```bash
vercel --prod
```

6. Note your Vercel URL (e.g., `https://personal-feed-aggregator.vercel.app`)

### Step 4: Update Frontend

1. Open `index.html`

2. Find this line (around line 580):
```javascript
const API_URL = 'https://easygoing-cooperation-production-08a4.up.railway.app';
```

3. Replace with your Vercel URL:
```javascript
const API_URL = 'https://personal-feed-aggregator.vercel.app';
```

4. Save the file

### Step 5: Deploy Frontend to Netlify

1. Push to GitHub:
```bash
git add .
git commit -m "Migrate to Vercel serverless"
git push
```

2. Go to https://app.netlify.com
3. Click "Add new site" → "Import an existing project"
4. Choose "Deploy with GitHub"
5. Select your repository
6. Configure settings:
   - Build command: (leave empty)
   - Publish directory: `.`
7. Click "Deploy site"

8. Wait for deployment (should be instant since it's static HTML)

9. Your site will be live at something like `https://symphonious-piroshki-43b8df.netlify.app`

## ✅ Testing Your Site

1. Visit your Netlify URL
2. You should see your feed aggregator
3. Click "Refresh" button to fetch articles
4. Try adding a new RSS feed
5. Mark articles as read

### Test API Endpoints Directly

```bash
# Get all articles
curl https://your-project.vercel.app/api/articles

# Get all sources
curl https://your-project.vercel.app/api/sources

# Refresh feeds
curl -X POST https://your-project.vercel.app/api/refresh
```

## 🎯 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/articles` | Get all articles (with query params) |
| GET | `/api/articles/:id` | Get specific article |
| PUT | `/api/articles/:id` | Mark article as read |
| GET | `/api/sources` | Get all RSS sources |
| POST | `/api/sources` | Add new RSS source |
| DELETE | `/api/sources/:id` | Delete RSS source |
| POST | `/api/refresh` | Manually refresh all feeds |

## 🧹 Cleanup Old Files

Once Vercel is working perfectly:

1. **Delete Railway project:**
   - Go to Railway dashboard
   - Select your project
   - Settings → Delete Project

2. **Remove old files from local project:**
   - Delete `server` file (old Express server)
   - Keep: `index.html`, `init-db.js`, `.env`, `.gitignore`

## 💰 Cost Breakdown

| Service | Cost | Limits |
|---------|------|--------|
| **Vercel** | ₹0/month | 100GB bandwidth, unlimited functions |
| **Supabase** | ₹0/month | 500MB database, 2GB bandwidth |
| **Netlify** | ₹0/month | 100GB bandwidth, unlimited sites |
| **TOTAL** | **₹0/month** | More than enough for personal use |

## 🔧 Troubleshooting

### "Database connection failed"
- Check `.env` has correct `DATABASE_URL`
- Verify Supabase project is active
- Check environment variables in Vercel dashboard

### "CORS error"
- All API files include CORS headers
- Check browser console for exact error
- Verify API_URL in index.html is correct

### "Articles not loading"
- Check Vercel deployment logs
- Test API directly: `curl https://your-app.vercel.app/api/articles`
- Verify database has data: run `node init-db.js` again

### "Refresh not working"
- Check Vercel function logs
- Verify RSS feed URLs are valid
- Some feeds may be slow (timeout after 10 seconds)

## 📝 Notes

- Frontend (Netlify) auto-deploys on GitHub push
- Backend (Vercel) auto-deploys on GitHub push
- Database (Supabase) is always available
- No cron job = click "Refresh" button to fetch new articles
- All services have generous free tiers

## 🎉 You're Done!

Your personal feed aggregator is now running 100% free on:
- ✅ Frontend: Netlify
- ✅ API: Vercel Serverless
- ✅ Database: Supabase PostgreSQL

Enjoy your ad-free, privacy-focused RSS reader! 🚀
