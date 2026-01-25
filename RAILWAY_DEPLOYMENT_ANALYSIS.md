# Railway Deployment Analysis - DynoPay Backend
**Date:** January 25, 2026  
**Status:** 🟡 **REQUIRES FIXES BEFORE DEPLOYMENT**

---

## 🔍 Deployment Readiness Assessment

### Overall Status: **70% Ready** 
- ✅ Database: Railway-ready (PostgreSQL already configured)
- ✅ Dependencies: All properly defined
- ✅ Environment Variables: Structured correctly
- ⚠️ **CRITICAL ISSUES:** Hardcoded URLs need fixing
- ⚠️ **MISSING:** Railway configuration files
- ⚠️ **NEEDS REVIEW:** File upload paths

---

## ❌ CRITICAL ISSUES (Must Fix Before Deploy)

### 1. **Hardcoded Localhost URLs** 🚨 BLOCKER

**Problem:** Multiple files have hardcoded `localhost` URLs that will break in production.

**Files Affected:**
```typescript
// ❌ /app/backend/controller/walletController.ts (Lines 1043, 1170)
redirect_url: "http://localhost:3000/payment/verify"
// Should be: process.env.FRONTEND_URL + "/payment/verify"

// ❌ /app/backend/utils/constants.ts (Line 1)
const allowedOrigins = ["http://localhost:3000"];
// Should include production frontend URL

// ❌ /app/backend/api-service/utils/constants.ts (Line 1)
const allowedOrigins = ["http://localhost:3000"];
// Same issue

// ❌ /app/backend/swagger/index.ts (Line 44)
url: process.env.SERVER_URL || "http://localhost:8001"
// Fallback is okay, but ensure SERVER_URL is set

// ❌ /app/backend/api-service/controller/index.ts (Line 20)
return process.env.INTERNAL_BACKEND_URL || process.env.SERVER_URL || 'http://localhost:3300';
// Fallbacks cascade correctly, but need env vars set
```

**Fix Required:**
```typescript
// walletController.ts
redirect_url: `${process.env.FRONTEND_URL}/payment/verify`

// constants.ts (both files)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://checkout.dynopay.com",
  ...(process.env.NODE_ENV === 'development' ? ["http://localhost:3000"] : [])
];
```

---

### 2. **Missing Environment Variables in .env**

**Required additions for Railway:**
```bash
# Frontend URL
FRONTEND_URL=https://your-frontend.railway.app

# Node Environment
NODE_ENV=production

# Database Connection String (Railway provides this)
DATABASE_URL=postgresql://...  # Railway auto-generates

# File Upload Path (if using local storage)
UPLOAD_PATH=/app/uploads

# API Service URL (if separate service)
INTERNAL_BACKEND_URL=http://localhost:3301  # Railway internal network
```

---

### 3. **CORS Configuration Needs Update**

**Current Issue:**
```typescript
// server.ts line 39
app.use(cors());  // ⚠️ Allows ALL origins (security risk)
```

**Should be:**
```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://checkout.dynopay.com']
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
```

---

## ⚠️ WARNINGS (Should Fix)

### 4. **Static File Serving Paths**

**Current Setup:**
```typescript
// server.ts lines 46-48
app.use(express.static("public"));
app.use("/images", express.static("/images"));  // Absolute path
app.use("/videos", express.static("/videos"));  // Absolute path
```

**Issues:**
- `/images` and `/videos` use absolute paths (may not exist on Railway)
- No indication where uploaded files are stored
- Railway filesystem is ephemeral (files disappear on restart)

**Recommendations:**
1. **Use Railway Persistent Volumes:**
   - Add volume mount in Railway dashboard
   - Or better yet...

2. **Use Cloud Storage (RECOMMENDED):**
   - AWS S3
   - Cloudinary
   - Railway's built-in storage

**Quick Fix for Deployment:**
```typescript
const uploadsPath = process.env.UPLOAD_PATH || path.join(__dirname, 'uploads');
app.use("/images", express.static(path.join(uploadsPath, "images")));
app.use("/videos", express.static(path.join(uploadsPath, "videos")));
```

---

### 5. **Port Binding**

**Current:**
```typescript
// server.ts line 37
const port = process.env.PORT || 3300;
```

✅ **GOOD:** Uses `process.env.PORT` (Railway requirement)  
⚠️ **NOTE:** Fallback is 3300 (should be fine, but Railway always provides PORT)

---

### 6. **Database Connection**

**Current:**
```typescript
// utils/dbInstance.ts
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.USER_NAME,
  process.env.PASSWORD,
  {
    host: process.env.HOST,
    port: Number(process.env.DB_PORT),
    dialect: "postgres",
  }
);
```

✅ **GOOD:** Uses environment variables  
⚠️ **RAILWAY BEST PRACTICE:** Use `DATABASE_URL` connection string instead

**Recommended Change:**
```typescript
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.USER_NAME,
      process.env.PASSWORD,
      {
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        dialect: "postgres",
      }
    );
```

---

### 7. **Redis Connection**

**Current:**
```bash
# .env line 23
REDIS_PUBLIC_URL=redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463
```

✅ **GOOD:** Already using Railway Redis  
✅ **READY:** No changes needed

---

## ✅ WHAT'S ALREADY GOOD

### 1. **Package.json Scripts** ✅
```json
"scripts": {
  "start": "ts-node server.ts"  // ✅ Railway will use this
}
```

### 2. **Dependencies** ✅
All dependencies are in `dependencies` (not devDependencies), so Railway will install them.

### 3. **TypeScript** ✅
Using `ts-node` directly - Railway supports this out of the box.

### 4. **Database** ✅
PostgreSQL already configured (Railway PostgreSQL is drop-in compatible).

### 5. **Environment Variable Structure** ✅
All config is properly externalized to .env

---

## 📋 REQUIRED FIXES CHECKLIST

### **CRITICAL (Must Do Before Deploy):**

- [ ] Fix hardcoded `localhost:3000` in `walletController.ts` (lines 1043, 1170)
- [ ] Fix hardcoded origins in `utils/constants.ts`
- [ ] Fix hardcoded origins in `api-service/utils/constants.ts`
- [ ] Update CORS configuration in `server.ts`
- [ ] Add `FRONTEND_URL` environment variable
- [ ] Add `NODE_ENV=production` environment variable

### **RECOMMENDED (Should Do):**

- [ ] Update database connection to support `DATABASE_URL`
- [ ] Fix static file paths to use relative paths
- [ ] Add Railway configuration files (optional but helpful)
- [ ] Set up cloud storage for file uploads
- [ ] Add health check endpoint
- [ ] Add graceful shutdown handling

### **OPTIONAL (Nice to Have):**

- [ ] Add logging to external service (Logtail, Datadog)
- [ ] Add monitoring (Sentry, New Relic)
- [ ] Add Railway deployment hooks
- [ ] Set up staging environment

---

## 🛠️ IMPLEMENTATION: Required Fixes

### Fix 1: Update walletController.ts
```typescript
// /app/backend/controller/walletController.ts
// Line 1043 and 1170, replace:
redirect_url: "http://localhost:3000/payment/verify"

// With:
redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/verify`
```

### Fix 2: Update CORS Origins
```typescript
// /app/backend/utils/constants.ts
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CHECKOUT_URL || "https://checkout.dynopay.com",
  ...(process.env.NODE_ENV !== 'production' ? ["http://localhost:3000"] : [])
].filter(Boolean);

export { allowedOrigins };
```

### Fix 3: Update CORS in server.ts
```typescript
// /app/backend/server.ts
import { allowedOrigins } from "./utils/constants";

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? allowedOrigins
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
```

### Fix 4: Update Database Connection
```typescript
// /app/backend/utils/dbInstance.ts
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      dialectOptions: process.env.NODE_ENV === 'production' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {},
      logging: process.env.NODE_ENV === 'production' ? false : console.log
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.USER_NAME,
      process.env.PASSWORD,
      {
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        dialect: "postgres",
        logging: false
      }
    );

export default sequelize;
```

### Fix 5: Add Health Check Endpoint
```typescript
// /app/backend/server.ts
// Add after other routes
app.get("/health", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy",
      database: "disconnected",
      error: error.message
    });
  }
});
```

---

## 📦 CREATE RAILWAY CONFIGURATION FILES

### 1. Create `railway.json`
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "yarn start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2. Create `nixpacks.toml` (Optional)
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x", "yarn"]

[phases.install]
cmds = ["yarn install --frozen-lockfile"]

[phases.build]
cmds = []

[start]
cmd = "yarn start"
```

### 3. Create `.railwayignore` (Optional)
```
node_modules/
.git/
.env
*.log
test/
*.test.ts
*.spec.ts
.vscode/
.idea/
```

---

## 🚀 RAILWAY DEPLOYMENT STEPS

### Step 1: Fix Code Issues
```bash
# Apply all critical fixes mentioned above
# Test locally first
cd /app/backend
yarn start
# Verify no localhost hardcoding breaks functionality
```

### Step 2: Create Railway Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo" or "Empty Project"

### Step 3: Add PostgreSQL Database
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will create database and provide `DATABASE_URL`
3. Copy connection string

### Step 4: Add Redis (Already Have External)
Option A: Use existing Railway Redis (already in .env)
Option B: Add new Redis service in Railway

### Step 5: Configure Environment Variables
In Railway dashboard, add these variables:

**Required:**
```
NODE_ENV=production
PORT=8001
FRONTEND_URL=https://your-frontend-url.railway.app
DATABASE_URL=postgresql://... (auto-provided by Railway)
REDIS_PUBLIC_URL=redis://... (auto-provided or use existing)
SERVER_URL=https://your-backend.railway.app
```

**Copy from existing .env:**
```
ACCESS_TOKEN_SECRET=...
API_SECRET=...
CYPHER_KEY=...
FLW_PUBLIC_KEY=...
FLW_SECRET_KEY=...
FLW_SECRET_HASH=...
FLW_ENCRYPTION_KEY=...
TATUM_KEY=...
TATUM_SECRET_KEY=...
... (all other API keys)
```

### Step 6: Deploy
1. Connect GitHub repo (or use Railway CLI)
2. Select backend directory as root
3. Railway auto-detects Node.js and uses `yarn start`
4. Watch build logs
5. Check deployment logs for errors

### Step 7: Run Migrations
```bash
# Option A: Railway CLI
railway run yarn migrate

# Option B: Add to start command
# Change package.json start script:
"start": "yarn migrate && ts-node server.ts"
```

### Step 8: Verify Deployment
```bash
# Test health endpoint
curl https://your-backend.railway.app/health

# Test API
curl https://your-backend.railway.app/api/status
```

---

## 🔒 SECURITY CONSIDERATIONS

### 1. **Environment Variables**
- ✅ All sensitive data in environment variables
- ❌ `.env` file should NOT be committed to git
- ✅ Use Railway's secret management

### 2. **CORS**
- ⚠️ Currently allows all origins (`app.use(cors())`)
- ❌ Must restrict to specific domains in production

### 3. **API Keys**
- ⚠️ Multiple API keys in .env (Flutterwave, Tatum, etc.)
- ✅ These are correctly externalized
- ✅ Make sure they're production keys, not test keys

### 4. **Database SSL**
- ⚠️ Current config doesn't enforce SSL
- ✅ Fixed in recommended database connection update

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment:
- [ ] All critical fixes applied
- [ ] Code tested locally
- [ ] Environment variables documented
- [ ] Database migration strategy planned
- [ ] Frontend URL confirmed
- [ ] API keys verified (production not test)

### During Deployment:
- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Redis configured
- [ ] All environment variables set
- [ ] GitHub repo connected
- [ ] Build successful
- [ ] Application started

### Post-Deployment:
- [ ] Health check returns 200
- [ ] API endpoints responding
- [ ] Database connection working
- [ ] Redis connection working
- [ ] Cron jobs running
- [ ] Frontend can connect to backend
- [ ] Payment flows tested
- [ ] Webhook endpoints accessible
- [ ] Logs reviewed for errors

---

## 🐛 TROUBLESHOOTING

### Issue: "Cannot connect to database"
**Solution:** Check DATABASE_URL is set correctly, verify SSL config

### Issue: "CORS error from frontend"
**Solution:** Verify FRONTEND_URL in allowedOrigins, check CORS config

### Issue: "File uploads not persisting"
**Solution:** Set up Railway volume or use cloud storage (S3/Cloudinary)

### Issue: "Port 3300 already in use"
**Solution:** Railway will use dynamic PORT, ensure code uses process.env.PORT

### Issue: "TypeScript compilation errors"
**Solution:** Railway uses ts-node, ensure all dependencies installed

---

## 💰 COST ESTIMATE

**Railway Pricing:**
- Hobby Plan: $5/month + usage
- Database: ~$5/month (PostgreSQL)
- Redis: ~$5/month
- Backend Service: ~$5-10/month
- **Total: ~$20-25/month**

---

## ✅ FINAL RECOMMENDATION

**Status:** Ready to deploy **AFTER fixing critical issues**

**Priority:**
1. ✅ Fix hardcoded localhost URLs (15 min)
2. ✅ Update CORS configuration (10 min)
3. ✅ Add environment variables (5 min)
4. ✅ Test locally (15 min)
5. ✅ Deploy to Railway (30 min)
6. ✅ Verify deployment (15 min)

**Total Time:** ~1.5 hours to production-ready

---

**Next Steps:** 
1. Apply critical fixes
2. Test locally
3. Create Railway project
4. Deploy

Would you like me to apply these fixes now?
