# 🚀 Railway Deployment Guide - DynoPay Backend
**Status:** ✅ **READY FOR DEPLOYMENT**  
**Date:** January 25, 2026

---

## ✅ PRE-DEPLOYMENT CHECKLIST

All critical issues have been fixed:

- [✅] Hardcoded localhost URLs removed
- [✅] CORS configuration updated
- [✅] Database connection supports Railway
- [✅] Environment variables externalized
- [✅] Health check endpoint added
- [✅] Railway configuration files created
- [✅] Static file paths made relative
- [✅] Backend tested locally

---

## 📦 STEP-BY-STEP DEPLOYMENT

### **Step 1: Create Railway Account**
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify email

### **Step 2: Create New Project**
1. Click "New Project"
2. Choose "Empty Project"
3. Name it: `dynopay-backend`

### **Step 3: Add PostgreSQL Database**
1. Click "+ New" → "Database" → "Add PostgreSQL"
2. Railway automatically creates database
3. Note: `DATABASE_URL` variable is auto-generated
4. Keep this tab open for later

### **Step 4: Add Redis (Optional - You Already Have External)**
**Option A:** Use your existing Railway Redis
- Already configured: `REDIS_PUBLIC_URL=redis://...@crossover.proxy.rlwy.net:37463`
- ✅ Skip this step

**Option B:** Add new Redis in Railway
1. Click "+ New" → "Database" → "Add Redis"
2. Railway auto-generates `REDIS_URL`

### **Step 5: Deploy Backend**

**Option A: Deploy from GitHub (Recommended)**
1. Click "+ New" → "GitHub Repo"
2. Select your repository
3. Railway detects Node.js project
4. Set **Root Directory:** `/backend` (if monorepo)
5. Railway will use `railway.json` configuration

**Option B: Deploy with Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy from /app/backend directory
cd /app/backend
railway up
```

### **Step 6: Configure Environment Variables**

In Railway Dashboard → Backend Service → Variables:

**Click "Add Variable" and paste these (update values):**

```bash
# SYSTEM
NODE_ENV=production
PORT=8001

# FRONTEND (Update after frontend deployment)
FRONTEND_URL=https://your-frontend.railway.app
CHECKOUT_URL=https://checkout.dynopay.com

# DATABASE (Railway auto-provides - don't add manually)
# DATABASE_URL is automatically available

# Or use individual credentials (if not using DATABASE_URL)
DB_NAME=railway
USER_NAME=postgres
PASSWORD=<from Railway PostgreSQL>
HOST=<from Railway PostgreSQL>
DB_PORT=5432

# REDIS (Use your existing)
REDIS_PUBLIC_URL=redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463

# FILE UPLOADS
UPLOAD_PATH=/app/uploads

# Copy ALL other variables from .env.railway.template
# (Authentication, API keys, wallet addresses, etc.)
```

**Quick Copy Method:**
1. Open `/app/backend/.env.railway.template`
2. Copy all variables
3. In Railway, click "Raw Editor"
4. Paste all variables
5. Update placeholder values
6. Click "Save"

### **Step 7: Update Frontend URL (After Backend Deploys)**

1. After backend deployment, Railway gives you a URL like:
   ```
   https://dynopay-backend-production-xxxx.up.railway.app
   ```

2. Go back to Variables and update:
   ```bash
   SERVER_URL=https://your-actual-backend-url.railway.app
   ```

3. Redeploy if needed (Railway auto-redeploys on variable change)

### **Step 8: Run Database Migrations**

**Option A: Railway CLI**
```bash
railway run yarn migrate
```

**Option B: Add to Start Command**
Update `package.json`:
```json
{
  "scripts": {
    "start": "npx sequelize-cli db:migrate && ts-node server.ts"
  }
}
```
Then commit and push (Railway auto-redeploys).

**Option C: Run Manually via Railway Shell**
1. Railway Dashboard → Backend Service
2. Click "Shell" tab
3. Run: `yarn migrate`

### **Step 9: Verify Deployment**

**Health Check:**
```bash
curl https://your-backend-url.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "DynoPay Backend",
  "database": "connected",
  "timestamp": "2026-01-25T14:30:00.000Z",
  "uptime": 123.45
}
```

**API Status:**
```bash
curl https://your-backend-url.railway.app/api/status
```

**Swagger Docs:**
```
https://your-backend-url.railway.app/api-docs
```

### **Step 10: Deploy Frontend**

1. Create new Railway service for frontend
2. Set `REACT_APP_BACKEND_URL` to your backend URL
3. Deploy frontend
4. Get frontend URL
5. Update backend `FRONTEND_URL` variable
6. Backend will auto-redeploy with new CORS settings

---

## 🔧 TROUBLESHOOTING

### **Issue: Build Fails**
**Check:**
- `package.json` has `start` script
- All dependencies in `dependencies` not `devDependencies`
- Node version compatible (18.x)

**Fix:**
```bash
# In Railway logs, check for missing dependencies
# Add to package.json and commit
```

### **Issue: Database Connection Fails**
**Check:**
- `DATABASE_URL` variable exists
- PostgreSQL service is running
- SSL is enabled (auto-handled by our code)

**Fix:**
```bash
# In Railway Dashboard → PostgreSQL → Connect
# Copy DATABASE_URL and verify it's in backend variables
```

### **Issue: "Unhealthy" Health Check**
**Check:**
```bash
curl https://your-url.railway.app/health
# Look at response error
```

**Common causes:**
- Database not connected
- Missing environment variables
- Migration not run

### **Issue: CORS Error from Frontend**
**Check:**
- `FRONTEND_URL` is set correctly
- `NODE_ENV=production` is set
- Frontend is actually deployed at that URL

**Fix:**
```bash
# Update FRONTEND_URL in Railway variables
# Redeploy if needed
```

### **Issue: 502 Bad Gateway**
**Causes:**
- App crashed on startup
- Port binding issue (ensure using `process.env.PORT`)
- Database connection failed

**Debug:**
```bash
# Check Railway logs
railway logs
```

### **Issue: Files Not Persisting**
**Problem:** Railway filesystem is ephemeral

**Solution:**
1. **Add Railway Volume:**
   - Dashboard → Service → Settings → Volumes
   - Add volume: `/app/uploads`
   - Or use cloud storage (recommended)

2. **Use Cloud Storage:**
   - AWS S3
   - Cloudinary
   - Upload care

---

## 📊 POST-DEPLOYMENT CHECKLIST

- [ ] Health check returns 200
- [ ] Swagger docs accessible
- [ ] Can login via API
- [ ] Can create company
- [ ] Can create payment link
- [ ] Webhooks accessible (test with webhook.site)
- [ ] Cron jobs running (check logs)
- [ ] Frontend can connect
- [ ] API keys working
- [ ] Referral system functional

---

## 🔐 SECURITY CHECKLIST

- [ ] All API keys are production keys (not test)
- [ ] `.env` file NOT committed to git
- [ ] CORS restricted to your domains only
- [ ] DATABASE_URL kept secret
- [ ] Redis password not exposed
- [ ] Swagger docs secured (if needed)

---

## 📈 MONITORING

### **Railway Built-in Monitoring**
- CPU usage
- Memory usage
- Network traffic
- Request logs

### **Custom Monitoring (Recommended)**
1. **Sentry** - Error tracking
   ```bash
   npm install @sentry/node
   # Add to server.ts
   ```

2. **Logtail** - Log management
   ```bash
   npm install @logtail/node
   # Configure in Railway
   ```

3. **UptimeRobot** - Uptime monitoring
   - Free tier: Check every 5 minutes
   - Monitor: `/health` endpoint

---

## 💰 COST ESTIMATE

**Railway Pricing (Hobby Plan):**
- Backend Service: ~$5-10/month
- PostgreSQL: ~$5/month  
- Redis: ~$5/month (if adding new)
- Total: **~$15-20/month**

**Tips to reduce costs:**
- Use external Redis (you already have this)
- Enable sleep on inactive (Hobby plan)
- Optimize container size

---

## 🚀 DEPLOYMENT COMMANDS QUICK REFERENCE

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs

# Open in browser
railway open

# Run migrations
railway run yarn migrate

# SSH into container
railway shell

# Check status
railway status

# List environment variables
railway variables
```

---

## 📱 MOBILE APP CONFIGURATION

If you have a mobile app, update these:

**iOS (Info.plist):**
```xml
<key>API_BASE_URL</key>
<string>https://your-backend.railway.app</string>
```

**Android (build.gradle):**
```gradle
buildConfigField "String", "API_BASE_URL", 
  '"https://your-backend.railway.app"'
```

---

## 🔄 CI/CD SETUP (Optional)

Railway auto-deploys on git push. To customize:

**Create `.github/workflows/deploy.yml`:**
```yaml
name: Deploy to Railway

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install Railway
        run: npm i -g @railway/cli
      
      - name: Deploy
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## ✅ SUCCESS CRITERIA

Deployment is successful when:

1. ✅ `/health` returns `"status": "healthy"`
2. ✅ `/api/status` returns data
3. ✅ Swagger docs load at `/api-docs`
4. ✅ Frontend can make API calls
5. ✅ Database queries work
6. ✅ Cron jobs are running
7. ✅ No errors in Railway logs
8. ✅ Response time < 2 seconds

---

## 📞 SUPPORT

**Railway Issues:**
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app
- Status: https://status.railway.app

**DynoPay Issues:**
- Check Railway logs first
- Review `/health` endpoint
- Check database connection
- Verify environment variables

---

## 🎉 NEXT STEPS AFTER DEPLOYMENT

1. **Test all endpoints** with Postman
2. **Deploy frontend** and connect
3. **Set up monitoring** (Sentry, Logtail)
4. **Configure domain** (custom domain in Railway)
5. **Set up SSL** (Railway provides free SSL)
6. **Configure webhooks** with payment providers
7. **Set up backups** for database
8. **Create staging environment** for testing

---

**Deployment Guide Version:** 1.0  
**Last Updated:** January 25, 2026  
**Deployment Time:** ~30 minutes  
**Difficulty:** Easy ⭐⭐☆☆☆

**Ready to Deploy!** 🚀
