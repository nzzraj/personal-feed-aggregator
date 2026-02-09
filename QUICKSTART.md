# 🚀 QUICK START GUIDE

Copy all these files to your project folder: `D:\users\Desktop\personal-feed-aggregator\`

## File Structure to Create in VS Code:

```
personal-feed-aggregator/
├── api/
│   ├── _db.js
│   ├── _parser.js
│   ├── articles.js
│   ├── articles/
│   │   └── [id].js
│   ├── sources.js
│   ├── sources/
│   │   └── [id].js
│   └── refresh.js
├── vercel.json
├── package.json
├── .gitignore
├── .env.example
├── README.md
└── (keep your existing index.html and init-db.js)
```

## 3-Minute Setup:

### 1️⃣ Set Up Database (2 min)
```bash
# Create .env with your Supabase URL
echo DATABASE_URL=your-supabase-url > .env
echo NODE_ENV=production >> .env

# Install packages
npm install

# Initialize database
node init-db.js
```

### 2️⃣ Deploy to Vercel (1 min)
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 3️⃣ Update Frontend
```javascript
// In index.html, change API_URL to:
const API_URL = 'https://your-project.vercel.app';
```

### 4️⃣ Push to GitHub
```bash
git add .
git commit -m "Migrate to Vercel"
git push
```

Netlify will auto-deploy! ✅

## That's it! 🎉

Your site is now 100% free and running on:
- Vercel (API)
- Netlify (Frontend) 
- Supabase (Database)
