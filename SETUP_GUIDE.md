# Personal Feed Aggregator - Complete Setup Guide

A personal RSS feed aggregator that fetches all your favorite blogs and websites into one beautiful interface.

## 🎯 What This Does

- Automatically fetches articles from any blog/website with an RSS feed
- Aggregates everything into one clean, scrollable feed
- Updates every hour automatically
- Tracks read/unread status
- Filters by source, date, and read status
- Search functionality
- Add/remove sources through the UI

## 🏗️ Architecture

```
Frontend (HTML/JS) → Backend API (Node.js) → PostgreSQL Database
                    ↓
                RSS Feeds from your favorite blogs
```

## 📦 What's Included

1. **Frontend** (`personal-feed-aggregator.html`)
   - Beautiful, responsive UI
   - Filter and search articles
   - Manage sources
   - Mark articles as read

2. **Backend** (`feed-backend/`)
   - Fetches RSS feeds automatically
   - Stores articles in database
   - REST API for frontend
   - Scheduled updates (every hour)

## 🚀 Quick Start

### Option 1: Deploy to Railway (Recommended - Easiest)

**Why Railway?**
- Everything in one place (backend + database)
- Automatic RSS fetching
- $5 free credit per month
- Simple deployment

**Steps:**

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Initialize project in the feed-backend folder**
   ```bash
   cd feed-backend
   railway init
   ```

4. **Add PostgreSQL database**
   ```bash
   railway add postgresql
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Initialize database**
   ```bash
   railway run npm run init-db
   ```

7. **Get your backend URL**
   ```bash
   railway domain
   ```
   You'll get something like: `your-app.railway.app`

8. **Update Frontend**
   - Open `personal-feed-aggregator.html`
   - Replace the API URL (search for `API_URL`)
   - Change to your Railway URL: `https://your-app.railway.app`

9. **Deploy Frontend to Vercel/Netlify**
   - Upload the HTML file
   - Done!

### Option 2: Deploy to Render

1. **Create PostgreSQL Database**
   - Go to https://render.com
   - New → PostgreSQL
   - Copy the connection string

2. **Create Web Service**
   - New → Web Service
   - Connect your Git repo (or upload files)
   - Build command: `npm install`
   - Start command: `npm start`
   - Add environment variable: `DATABASE_URL` (paste connection string)

3. **Initialize Database**
   - In Render dashboard, open Shell
   - Run: `npm run init-db`

4. **Update Frontend**
   - Get your Render URL (e.g., `your-app.onrender.com`)
   - Update API_URL in HTML file
   - Deploy frontend to Vercel/Netlify

## 🔧 Local Development

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed locally

### Setup

1. **Install PostgreSQL**
   - Mac: `brew install postgresql`
   - Ubuntu: `sudo apt-get install postgresql`
   - Windows: Download from postgresql.org

2. **Create Database**
   ```bash
   createdb feed_aggregator
   ```

3. **Install Dependencies**
   ```bash
   cd feed-backend
   npm install
   ```

4. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```
   DATABASE_URL=postgresql://localhost:5432/feed_aggregator
   PORT=3000
   NODE_ENV=development
   ```

5. **Initialize Database**
   ```bash
   npm run init-db
   ```

6. **Start Backend**
   ```bash
   npm run dev
   ```
   Backend runs on http://localhost:3000

7. **Update Frontend**
   - Open `personal-feed-aggregator.html`
   - Update API_URL to `http://localhost:3000`
   - Open in browser

## 📝 Adding Your Own Blogs

### Method 1: Through the UI
1. Click "⚙ Manage Sources"
2. Add blog name and RSS feed URL
3. Click "Add Source"
4. Click "↻ Refresh" to fetch articles

### Method 2: Directly in Database
```sql
INSERT INTO sources (name, url, feed_url, category) 
VALUES ('Blog Name', 'https://example.com', 'https://example.com/feed', 'tech');
```

### Finding RSS Feeds

Most blogs have RSS feeds at these URLs:
- `https://example.com/feed`
- `https://example.com/rss`
- `https://example.com/feed.xml`
- `https://example.com/rss.xml`

Or look for RSS icons on the website.

**Popular Blog RSS Feeds:**

| Blog | RSS Feed URL |
|------|-------------|
| Paul Graham | http://www.paulgraham.com/rss.html |
| Wait But Why | https://waitbutwhy.com/feed |
| Stratechery | https://stratechery.com/feed |
| The Marginalian | https://www.themarginalian.org/feed/ |
| Farnam Street | https://fs.blog/feed/ |
| Seth Godin | https://seths.blog/feed/atom/ |
| Daring Fireball | https://daringfireball.net/feeds/main |
| Joel on Software | https://www.joelonsoftware.com/feed/ |
| Hacker News | https://news.ycombinator.com/rss |
| Dev.to | https://dev.to/feed |

## 🎨 Customization

### Change Colors

Edit the CSS in `personal-feed-aggregator.html`:

```css
/* Background gradient */
background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #2a1f3a 100%);

/* Accent color (currently red) */
color: #ff6b6b; /* Change to your color */
```

### Change Fonts

Replace the Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap" rel="stylesheet">
```

### Change Refresh Frequency

Edit `server.js`:
```javascript
// Current: every hour
cron.schedule('0 * * * *', () => {
  fetchAllFeeds();
});

// Every 30 minutes
cron.schedule('*/30 * * * *', () => {
  fetchAllFeeds();
});

// Every 6 hours
cron.schedule('0 */6 * * *', () => {
  fetchAllFeeds();
});
```

## 🔐 Security Notes

### For Production:

1. **Add Authentication** (if you want it private)
   ```javascript
   app.use((req, res, next) => {
     const apiKey = req.headers['x-api-key'];
     if (apiKey === process.env.API_KEY) {
       next();
     } else {
       res.status(401).json({ error: 'Unauthorized' });
     }
   });
   ```

2. **CORS Configuration**
   ```javascript
   app.use(cors({
     origin: 'https://your-frontend-domain.com'
   }));
   ```

3. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/articles` | GET | Get all articles (with filters) |
| `/api/articles/:id` | GET | Get single article |
| `/api/articles/:id/read` | POST | Mark article as read |
| `/api/sources` | GET | Get all sources |
| `/api/sources` | POST | Add new source |
| `/api/sources/:id` | DELETE | Delete source |
| `/api/refresh` | POST | Manually refresh all feeds |
| `/api/stats` | GET | Get statistics |
| `/api/search?q=term` | GET | Search articles |

## 🐛 Troubleshooting

### Feeds not fetching?
- Check if the RSS URL is valid
- Some sites block automated requests - try adding a user agent
- Check server logs for errors

### Articles not showing?
- Open browser console (F12) for errors
- Check if API_URL is correct
- Verify backend is running

### Database connection failed?
- Check DATABASE_URL is correct
- Verify PostgreSQL is running
- Check firewall settings

## 💡 Advanced Features

### Add Email Notifications
Use a service like SendGrid to email new articles

### Mobile App
Use React Native or Flutter to create a mobile version

### Browser Extension
Create a Chrome extension that opens your aggregator

### AI Summaries
Integrate Claude API to summarize articles

## 📚 Popular Blog Lists to Add

**Tech:**
- news.ycombinator.com/rss
- lobste.rs/rss
- dev.to/feed

**Startups:**
- avc.com/feed
- bothsidesofthetable.com/feed
- tomtunguz.com/feed

**Design:**
- sidebar.io/feed
- uxdesign.cc/feed

**Science:**
- quantamagazine.org/feed
- arstechnica.com/feed

**Writing:**
- austinkleon.com/feed
- themarginalian.org/feed

## 🎯 Next Steps

1. Deploy backend to Railway
2. Deploy frontend to Vercel
3. Add your favorite blogs
4. Enjoy your personalized reading feed!

## 📞 Need Help?

Check the server logs:
```bash
railway logs
# or
heroku logs --tail
```

Common issues:
- **RSS feed not found**: The blog might not have RSS
- **CORS error**: Update CORS settings in backend
- **Rate limited**: Some feeds limit requests - spread them out

---

Made with ❤️ for indie blog readers
