# DynoPay API - Missing Endpoints Analysis & Implementation Plan
**Date:** January 25, 2026  
**Analysis Based On:** Frontend UI Screenshots & Backend Codebase Review

---

## Executive Summary

Analysis of the DynoPay frontend reveals several features visible in the UI that are **missing corresponding backend endpoints**. This document identifies these gaps and provides implementation recommendations for:

1. **Referral Code System** - Visible in UI but no backend support
2. **Knowledge Base** - Linked in UI but not implemented
3. **Profile Picture Management** - Upload/Remove functionality visible
4. **Enhanced API Key Management** - Multiple features missing
5. **Additional Security Features** - 2FA, session management, etc.

---

## Current Backend Routes Inventory

### ✅ Implemented Routes

| Category | Router | Key Endpoints |
|----------|--------|---------------|
| **Users** | `userRouter.ts` | Registration, Login, Profile, Password, Social Auth |
| **Company** | `companyRouter.ts` | CRUD operations, TAX validation |
| **API Keys** | `apiRouter.ts` | Create, Read, Update, Delete, Regenerate |
| **Payments** | `paymentRouter.ts` | Payment links, transactions |
| **Wallets** | `walletRouter.ts` | Wallet management, addresses |
| **Dashboard** | `dashboardRouter.ts` | Analytics, statistics |
| **Notifications** | `notificationRouter.ts` | Preferences, alerts |
| **Tax** | `taxRouter.ts` | Tax rates, validation |
| **KYC** | `kycRouter.ts` | Identity verification |
| **Invoice** | `invoiceRouter.ts` | Invoice generation |
| **Subscriptions** | `subscriptionRouter.ts` | Plans, subscriptions |
| **Admin** | `adminRouter.ts` | Admin operations |

---

## 🚨 Missing Endpoints Identified

### 1. **Referral Code System** ❌

**UI Evidence:**
- Image shows "Referral Code: DYNO2024XYZ" with copy button
- Clearly visible in API Keys page

**Current Status:** ❌ **NOT IMPLEMENTED**

**Missing Endpoints:**
```typescript
// Referral endpoints needed
GET    /api/user/referral-code              // Get user's referral code
POST   /api/user/referral-code/regenerate   // Regenerate referral code
GET    /api/user/referrals                  // List users referred
GET    /api/user/referral-stats             // Referral statistics
POST   /api/user/apply-referral             // Apply referral code during signup
GET    /api/user/referral-earnings          // Track referral rewards
```

**Database Schema Required:**
```sql
-- tbl_user additions
ALTER TABLE tbl_user ADD COLUMN referral_code VARCHAR(50) UNIQUE;
ALTER TABLE tbl_user ADD COLUMN referred_by_user_id INTEGER REFERENCES tbl_user(user_id);
ALTER TABLE tbl_user ADD COLUMN referral_bonus_earned DECIMAL(10,2) DEFAULT 0;

-- New table for tracking referrals
CREATE TABLE tbl_referral (
  referral_id SERIAL PRIMARY KEY,
  referrer_user_id INTEGER NOT NULL REFERENCES tbl_user(user_id),
  referred_user_id INTEGER NOT NULL REFERENCES tbl_user(user_id),
  referral_code VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, active, rewarded
  bonus_amount DECIMAL(10,2),
  bonus_currency VARCHAR(10),
  referred_at TIMESTAMP DEFAULT NOW(),
  rewarded_at TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

---

### 2. **Knowledge Base** ❌

**UI Evidence:**
- "Knowledge Base" link visible in navigation/footer
- Expected to provide help articles and documentation

**Current Status:** ❌ **NOT IMPLEMENTED**

**Missing Endpoints:**
```typescript
// Knowledge Base endpoints
GET    /api/knowledge-base/categories        // List article categories
GET    /api/knowledge-base/articles          // List all articles
GET    /api/knowledge-base/articles/:id      // Get article by ID
GET    /api/knowledge-base/search            // Search articles
POST   /api/knowledge-base/articles/:id/helpful  // Mark article as helpful
GET    /api/knowledge-base/popular           // Most viewed articles

// Admin endpoints (if needed)
POST   /api/admin/knowledge-base/articles    // Create article
PUT    /api/admin/knowledge-base/articles/:id // Update article
DELETE /api/admin/knowledge-base/articles/:id // Delete article
```

**Database Schema Required:**
```sql
CREATE TABLE tbl_kb_category (
  category_id SERIAL PRIMARY KEY,
  category_name VARCHAR(255) NOT NULL,
  category_icon VARCHAR(100),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tbl_kb_article (
  article_id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES tbl_kb_category(category_id),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id INTEGER REFERENCES tbl_user(user_id),
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tbl_kb_article_tag (
  tag_id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES tbl_kb_article(article_id),
  tag_name VARCHAR(100),
  createdAt TIMESTAMP DEFAULT NOW()
);
```

---

### 3. **Profile Picture Management** ⚠️ Partially Implemented

**UI Evidence:**
- Profile page shows "Upload new photo" and "Remove" buttons
- Profile picture displayed in header

**Current Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**Existing:** 
- ✅ Upload endpoint exists: `PUT /api/user/updateUser` with `uploadImage.single("image")`

**Missing Endpoints:**
```typescript
// Enhanced profile picture endpoints
DELETE /api/user/profile-picture           // Remove profile picture
GET    /api/user/profile-picture/:userId   // Get specific user's picture
POST   /api/user/profile-picture/upload    // Dedicated upload endpoint
```

**Improvements Needed:**
- Separate profile picture endpoint (not bundled with updateUser)
- Image resizing/optimization before storage
- Support for multiple image formats
- CDN integration for faster loading

---

### 4. **Enhanced API Key Management** ⚠️ Needs Enhancement

**UI Evidence from Images:**
- Shows Production & Development API keys separately
- "Create New Key" button
- Copy, View, Delete actions per key
- Admin Token displayed alongside API key
- Status indicators (Active/Inactive)
- Creation timestamp

**Current Implementation:** ✅ Basic CRUD exists

**Missing/Enhancement Endpoints:**
```typescript
// Enhanced API Key endpoints
GET    /api/userApi/keys/production          // List only production keys
GET    /api/userApi/keys/development         // List only development keys
POST   /api/userApi/keys/:id/rotate          // Rotate API key
GET    /api/userApi/keys/:id/usage-stats     // API key usage statistics
POST   /api/userApi/keys/:id/whitelist-ip    // Add IP to whitelist
DELETE /api/userApi/keys/:id/whitelist-ip    // Remove IP from whitelist
GET    /api/userApi/keys/:id/request-logs    // Recent API requests with this key
POST   /api/userApi/keys/:id/permissions     // Update key permissions
GET    /api/userApi/keys/:id/rate-limits     // Get rate limit info
```

**Database Enhancements:**
```sql
-- Add to tbl_api table
ALTER TABLE tbl_api ADD COLUMN admin_token TEXT;
ALTER TABLE tbl_api ADD COLUMN ip_whitelist TEXT[];  -- Array of allowed IPs
ALTER TABLE tbl_api ADD COLUMN last_used_at TIMESTAMP;
ALTER TABLE tbl_api ADD COLUMN request_count INTEGER DEFAULT 0;
ALTER TABLE tbl_api ADD COLUMN rate_limit_per_minute INTEGER DEFAULT 60;
ALTER TABLE tbl_api ADD COLUMN permissions JSONB;  -- {"payments": true, "wallets": false}

-- New table for API key usage logs
CREATE TABLE tbl_api_usage_log (
  log_id SERIAL PRIMARY KEY,
  api_id INTEGER REFERENCES tbl_api(api_id),
  endpoint VARCHAR(500),
  method VARCHAR(10),
  status_code INTEGER,
  ip_address VARCHAR(50),
  user_agent TEXT,
  request_time TIMESTAMP DEFAULT NOW(),
  response_time_ms INTEGER
);
```

---

### 5. **Security Features** ❌

**UI Shows:**
- KYC Required indicator
- Profile security settings

**Missing Security Endpoints:**
```typescript
// Two-Factor Authentication (2FA)
POST   /api/user/2fa/enable                  // Enable 2FA
POST   /api/user/2fa/verify                  // Verify 2FA code
POST   /api/user/2fa/disable                 // Disable 2FA
GET    /api/user/2fa/qr-code                 // Get QR code for authenticator app
POST   /api/user/2fa/backup-codes            // Generate backup codes

// Session Management
GET    /api/user/sessions                    // List active sessions
DELETE /api/user/sessions/:id               // Revoke specific session
DELETE /api/user/sessions/all               // Revoke all other sessions

// Login History
GET    /api/user/login-history               // Get login history
GET    /api/user/security-alerts             // Get security notifications

// Account Security
POST   /api/user/verify-identity             // Additional identity verification
GET    /api/user/security-settings           // Get all security settings
PUT    /api/user/security-settings           // Update security preferences
```

**Database Schema:**
```sql
CREATE TABLE tbl_user_2fa (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES tbl_user(user_id),
  secret TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  enabled_at TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tbl_user_session (
  session_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id),
  session_token TEXT UNIQUE NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50),
  location VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE TABLE tbl_login_history (
  history_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id),
  login_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent TEXT,
  device_type VARCHAR(50),
  location VARCHAR(255),
  login_method VARCHAR(50),  -- password, google, facebook, 2fa
  status VARCHAR(50)          -- success, failed, blocked
);
```

---

### 6. **Account Management Features** ⚠️ Partially Implemented

**Missing Endpoints:**
```typescript
// Enhanced Account Management
GET    /api/user/account-activity            // Recent account activity
POST   /api/user/export-data                 // Export user data (GDPR)
GET    /api/user/connected-accounts          // List connected social accounts
DELETE /api/user/connected-accounts/:provider // Disconnect social account
PUT    /api/user/preferences                 // Update user preferences
GET    /api/user/api-tokens                  // Personal access tokens (if applicable)
```

---

## 📋 Implementation Recommendations

### Priority 1: Critical Features (Implement First)

#### 1.1 Referral System
**Business Impact:** High - Drives user acquisition
**Implementation Effort:** Medium
**Timeline:** 1-2 weeks

**Implementation Plan:**
```typescript
// Step 1: Database migrations
// Step 2: Create referralController.ts
// Step 3: Create referralRouter.ts
// Step 4: Add referral code generation on user registration
// Step 5: Track referrals and calculate rewards
// Step 6: Create admin dashboard for referral management
```

**Referral Code Logic:**
```typescript
// Generate unique referral code
function generateReferralCode(userId: number, userName: string): string {
  const prefix = "DYNO";
  const year = new Date().getFullYear();
  const userPart = userName.substring(0, 3).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${year}${userPart}${randomPart}`;
  // Example: DYNO2026JOH4X7Z
}
```

**Reward Structure Suggestions:**
- Referrer gets $10 credit when referee makes first transaction > $100
- Referee gets 50% off transaction fees for first month
- Tiered rewards: 5 referrals = $100 bonus, 10 referrals = $250 bonus

---

#### 1.2 Enhanced API Key Management
**Business Impact:** High - Core product feature
**Implementation Effort:** Low-Medium
**Timeline:** 1 week

**Key Improvements:**
1. Add `admin_token` field to existing API key records
2. Implement IP whitelisting
3. Add usage tracking and logs
4. Create rate limiting per key
5. Add permissions/scopes system

---

### Priority 2: High Value Features

#### 2.1 Two-Factor Authentication (2FA)
**Business Impact:** High - Security critical for crypto payments
**Implementation Effort:** Medium
**Timeline:** 1-2 weeks

**Implementation:**
- Use `speakeasy` library for TOTP generation
- Store encrypted secrets in database
- Generate backup codes
- Enforce 2FA for high-value transactions

---

#### 2.2 Knowledge Base
**Business Impact:** Medium - Reduces support load
**Implementation Effort:** Medium-High
**Timeline:** 2-3 weeks

**Features:**
- Category-based organization
- Full-text search
- Rich text editor for articles
- View tracking
- Helpful/Not Helpful feedback
- Related articles suggestions

**Consider Using:**
- **Option A:** Build custom solution (more control)
- **Option B:** Integrate with existing platforms (Intercom, Zendesk, GitBook)
- **Recommendation:** Build MVP with basic articles, integrate with external platform later if needed

---

### Priority 3: Nice-to-Have Features

#### 3.1 Session Management
**Business Impact:** Medium - Security enhancement
**Implementation Effort:** Medium
**Timeline:** 1 week

#### 3.2 Login History & Security Alerts
**Business Impact:** Medium - User trust & compliance
**Implementation Effort:** Low-Medium
**Timeline:** 3-5 days

#### 3.3 Profile Picture Enhancements
**Business Impact:** Low - UX improvement
**Implementation Effort:** Low
**Timeline:** 2-3 days

---

## 🎯 Suggested Implementation Roadmap

### Phase 1: Critical Features (Weeks 1-3)
1. **Week 1:** Referral System - Backend + Database
2. **Week 2:** Referral System - Frontend Integration + Testing
3. **Week 3:** Enhanced API Key Management

### Phase 2: Security Features (Weeks 4-6)
1. **Week 4-5:** Two-Factor Authentication
2. **Week 6:** Session Management + Login History

### Phase 3: Support Features (Weeks 7-9)
1. **Week 7-8:** Knowledge Base MVP
2. **Week 9:** Profile Management Enhancements

---

## 📊 Current vs. Proposed API Surface

| Feature Category | Current Endpoints | Proposed Endpoints | Gap |
|------------------|-------------------|-------------------|-----|
| **User Management** | 17 | 25 | +8 |
| **API Keys** | 5 | 14 | +9 |
| **Security** | 3 | 12 | +9 |
| **Referrals** | 0 | 6 | +6 |
| **Knowledge Base** | 0 | 8 | +8 |
| **TOTAL** | ~80 | ~120 | **+40** |

---

## 🔍 Additional Observations

### From Profile Page Analysis:

**Existing Features (Good):**
- ✅ Password update
- ✅ Email/Mobile update
- ✅ Profile picture upload
- ✅ Social login (Google/Telegram)

**Missing Features:**
- ❌ 2FA toggle
- ❌ Session management
- ❌ Login history
- ❌ Connected devices
- ❌ Privacy settings
- ❌ Notification preferences (partial - exists but not in profile)

### From API Keys Page Analysis:

**Existing Features (Good):**
- ✅ Environment separation (Production/Development)
- ✅ API key visibility toggle
- ✅ Copy functionality
- ✅ Status indicators
- ✅ Base currency selection

**Missing Features:**
- ❌ Admin token generation/display
- ❌ IP whitelisting UI
- ❌ Usage statistics
- ❌ Rate limit configuration
- ❌ Permission scopes
- ❌ Last used timestamp
- ❌ Request logs

---

## 💡 Design Recommendations

### Referral System UX
```
┌─────────────────────────────────────────┐
│  Your Referral Code                     │
│  ┌─────────────────────────────────┐   │
│  │ DYNO2026JOH4X7Z        [Copy]   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Referral Stats                         │
│  • Total Referrals: 12                  │
│  • Active Users: 8                      │
│  • Earnings: $120.00                    │
│                                         │
│  Recent Referrals                       │
│  • Jane Doe - 2 days ago - Active       │
│  • Bob Smith - 5 days ago - Pending     │
│  [View All Referrals]                   │
└─────────────────────────────────────────┘
```

### Knowledge Base UX
```
┌─────────────────────────────────────────┐
│  🔍 Search knowledge base...            │
├─────────────────────────────────────────┤
│  Popular Articles                       │
│  📄 How to create API keys              │
│  💳 Payment link setup guide            │
│  🔐 Securing your account               │
├─────────────────────────────────────────┤
│  Categories                             │
│  📦 Getting Started                     │
│  🔧 API Documentation                   │
│  💰 Payments & Transactions             │
│  🔒 Security                            │
│  ❓ FAQ                                 │
└─────────────────────────────────────────┘
```

---

## ✅ Next Steps

1. **Get stakeholder approval** on priority order
2. **Create detailed technical specs** for Phase 1 features
3. **Set up database migrations** for new tables
4. **Implement referral system** as first priority
5. **Update Swagger documentation** as endpoints are added
6. **Create comprehensive tests** for each new feature
7. **Update frontend** to consume new endpoints

---

## 📝 Conclusion

The DynoPay backend is well-structured but has **40+ missing endpoints** for features visible or implied in the frontend. The most critical gaps are:

1. **Referral System** - Complete missing feature
2. **Knowledge Base** - Complete missing feature  
3. **Enhanced Security** - 2FA, session management
4. **API Key Enhancements** - Admin tokens, IP whitelisting, usage tracking

Implementing these features will:
- ✅ Complete the product feature set
- ✅ Improve user acquisition (referrals)
- ✅ Reduce support burden (knowledge base)
- ✅ Enhance security posture (2FA, sessions)
- ✅ Provide better developer experience (API key management)

**Estimated Total Development Time:** 9-12 weeks for all features
**Recommended Approach:** Phased implementation starting with referral system

---

**Document Version:** 1.0  
**Last Updated:** January 25, 2026  
**Author:** Development Team  
**Status:** Ready for Review & Implementation
