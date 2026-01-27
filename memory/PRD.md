# DynoPay Backend - Product Requirements Document

## Original Problem Statement
Set up a crypto payment gateway backend from GitHub repositories (DynoBackend & DynoBackendAPI), merge them into a monorepo, and implement comprehensive feature additions including company profiles, tax integration, dashboard APIs, notifications, authentication fixes, and more.

## Architecture
```
/app/backend/
├── api-service/          # Secondary API service (port 3301)
├── controller/           # Business logic
├── models/               # Sequelize models (PostgreSQL)
├── routes/               # Express routes
├── services/             # Shared services
├── utils/                # Utilities
├── jobs/                 # Cron jobs
└── server.ts             # Main entry (port 8001)
```

**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL, Redis, Sequelize ORM

---

## Implemented Features

### Critical Fixes ✅ (December 2025)
- **KMS Integration Fixed**: Replaced broken `fast-crc32c` native module with `@aws-crypto/crc32c` for Google Cloud KMS
- **Tatum Subscription Fixed**: Corrected webhook URL construction and error handling
- **Admin Fee Multi-Tenancy Verified**: ✅ Confirmed `company_id` flows correctly through entire payment lifecycle
  - Analysis document: `/app/ADMIN_FEE_MULTI_TENANCY_ANALYSIS.md`
  - Test file: `/app/backend/tests/adminFeeMultiTenancy.test.ts`
- **Wallet Migration Analysis**: Confirmed no data migration needed for multi-tenancy

### Phase 1: Database Schema Updates ✅
- **Modified Tables:** tbl_company, tbl_api, tbl_user_wallet, tbl_user_addresses
- **New Tables:** tbl_tax_rate, tbl_invoice, tbl_notification, tbl_notification_preferences, tbl_kyc

### Phase 2: Company Profile & Tax Integration ✅
- **Controller**: `/app/backend/controller/taxController.ts` (317 lines)
- **Routes**: `/app/backend/routes/taxRouter.ts`
- **Endpoints**:
  - `GET /api/tax/rate/:countryCode` - Get tax rate by country
  - `POST /api/tax/validate` - Validate tax ID
  - `GET /api/tax/acronyms` - Get tax acronyms by country
  - `GET /api/tax/lookup` - Lookup by country name

### Phase 3: Dashboard APIs ✅
- **Controller**: `/app/backend/controller/dashboardController.ts` (470 lines)
- **Routes**: `/app/backend/routes/dashboardRouter.ts`
- **Endpoints**:
  - `GET /api/dashboard` - Main dashboard data
  - `GET /api/dashboard/chart` - Chart data
  - `GET /api/dashboard/fee-tiers` - Fee tier information
  - `GET /api/dashboard/recent-transactions` - Recent transactions

### Phase 4: Notifications System ✅
- **Controller**: `/app/backend/controller/notificationController.ts` (406 lines)
- **Routes**: `/app/backend/routes/notificationRouter.ts`
- **Endpoints**:
  - `GET /api/notifications` - Get notifications
  - `GET /api/notifications/preferences` - Get user preferences
  - `PUT /api/notifications/preferences` - Update preferences
  - `GET /api/notifications/unread-count` - Unread count
  - `PUT /api/notifications/read-all` - Mark all as read
  - `PUT /api/notifications/:id/read` - Mark single as read
  - `DELETE /api/notifications/:id` - Delete notification

### Phase 11: KYC System ✅
- **Controller**: `/app/backend/controller/kycController.ts` (480 lines)
- **Routes**: `/app/backend/routes/kycRouter.ts`
- **Endpoints**:
  - `GET /api/kyc/status` - Get KYC status
  - `GET /api/kyc/requirements` - Get KYC requirements
  - `POST /api/kyc/submit` - Start KYC verification
  - `POST /api/kyc/webhook` - Veriff webhook handler

### Phase 12: Invoice Generation ✅
- **Controller**: `/app/backend/controller/invoiceController.ts` (512 lines)
- **Routes**: `/app/backend/routes/invoiceRouter.ts`
- **Endpoints**:
  - `GET /api/invoices/transaction/:txId` - Get invoice for transaction
  - `GET /api/invoices` - Get all invoices
  - `GET /api/invoices/:id` - Get single invoice
  - `GET /api/invoices/:id/download` - Download PDF

### Phase 13: Swagger/OpenAPI Documentation ✅ (December 2025)
- **Complete API documentation** with 151 documented endpoints
- **Path Definition Files** created in `/app/backend/swagger/paths/`:
  - `user.ts` - User Management (16 endpoints)
  - `payment.ts` - Payment Processing (17 endpoints) **with realistic request/response examples**
  - `wallet.ts` - Wallet Management (9 endpoints) **CLEANED - Legacy endpoints removed**
  - `admin.ts` - Admin Operations (15 endpoints)
  - `subscription.ts` - Subscriptions (5 endpoints)
  - `apiKeys.ts` - API Keys Management (15 endpoints)
  - `notification.ts` - Notifications (5 new endpoints)
  - `api.ts` & `status.ts` - Auth, Dashboard, Tax, Company, KYC, Status
  - `referral.ts` - Referral System (6 endpoints) **NEW**
  - `knowledgeBase.ts` - Knowledge Base (9 endpoints) **NEW**
  - `apiUsage.ts` - API Usage/Logs/Rate Limits (5 endpoints) **NEW**
- **Swagger UI**: Available at `/api/docs`
- **OpenAPI Spec**: Available at `/api/docs.json`
- **Coverage improved**: From 38% to 100%
- **Payment Examples Added**: E-commerce checkout, invoice payment, crypto payment flows with multiple scenarios
- **Webhook Documentation**: 8 merchant webhook payload examples (payment.completed, pending, confirming, partial, expired, failed, refunded) + 3 Tatum internal webhook examples
- **New Schemas Added (January 2026)**: Referral, ReferralReward, KBCategory, KBArticle
- **Swagger Cleanup (January 2026)**: Removed all legacy wallet endpoints (`getWalletAddresses`, etc.), now shows only primary payment forwarding wallet system

### Phase 14: Referral System ✅ (January 2026)
- **Controller**: `/app/backend/controller/referralController.ts` (488 lines)
- **Routes**: `/app/backend/routes/referralRouter.ts`
- **Models**: `/app/backend/models/referralModels/`
- **Endpoints**:
  - `GET /api/referral/my-code` - Get user's referral code and stats
  - `GET /api/referral/list` - List user's referrals with pagination
  - `GET /api/referral/earnings` - Get referral earnings summary
  - `POST /api/referral/validate` - Validate a referral code
  - `POST /api/referral/apply` - Apply referral code during signup
  - `GET /api/referral/leaderboard` - Get top referrers
- **Features**: Auto-generated referral codes (DYNO{YEAR}{USER}{RANDOM}), $10 bonus for referrer, 50% fee discount for referee

### Phase 15: Knowledge Base ✅ (January 2026)
- **Controller**: `/app/backend/controller/knowledgeBaseController.ts` (449 lines)
- **Routes**: `/app/backend/routes/knowledgeBaseRouter.ts`
- **Models**: `/app/backend/models/knowledgeBaseModels/`
- **Public Endpoints**:
  - `GET /api/kb/categories` - Get all categories
  - `GET /api/kb/articles` - Get articles (with category filter)
  - `GET /api/kb/articles/:slug` - Get article by slug
  - `GET /api/kb/search` - Full-text search
  - `GET /api/kb/popular` - Get most viewed articles
  - `POST /api/kb/articles/:id/feedback` - Submit helpful/not helpful feedback
- **Admin Endpoints**:
  - `POST /api/kb/admin/articles` - Create article
  - `PUT /api/kb/admin/articles/:id` - Update article
  - `DELETE /api/kb/admin/articles/:id` - Delete article

### Phase 16: Enhanced API Key Management ✅ (January 2026)
- **Controller**: `/app/backend/controller/apiController.ts` (Enhanced)
- **Routes**: `/app/backend/routes/apiRouter.ts`
- **New Endpoints**:
  - `GET /api/userApi/usage/:id` - API usage statistics (daily request counts, avg response time, top endpoints)
  - `GET /api/userApi/logs/:id` - API request logs with filtering
  - `PUT /api/userApi/rateLimit/:id` - Update rate limits (per minute/hour/day)
- **Features**: Environment support (production/development), admin tokens, rate limit configuration, usage tracking

---

## API Testing Status (January 2026)

### Comprehensive API Testing ✅ COMPLETED
- **Total Endpoints Tested:** ~70 out of ~95
- **Pass Rate:** ~94%
- **Test Reports:** 
  - `/app/SWAGGER_TEST_PLAN.md` - Full test checklist
  - `/app/API_TEST_REPORT_PHASE4-15.md` - Detailed results

### Test Phases Completed:
1. ✅ Phase 1-3: User Profile, Company Management, Wallet Management (100%)
2. ✅ Phase 4: API Key Management (12/13 passed)
3. ✅ Phase 5-7: Payment Links, Transactions, Dashboard (100%)
4. ✅ Phase 8-12: Notifications, Tax, Invoices, Referral, Subscriptions
5. ✅ Phase 13-15: System Status, KYC, Payment Processing

### Known Bugs Found:
1. **POST /api/userApi/createPlan** - 500 Error (null pointer when no API for company)
2. **POST /api/pay/getCurrencyRates** - 500 Error (param validation issue)

### Feature Enhancements (January 2026):
- **GET /api/dashboard/fee-tiers** - Now returns user's current tier based on transaction volume
  - Added `is_current` flag to each tier
  - Added `user_tier` object with: current_tier, monthly_volume, percent_to_next_tier, amount_to_next_tier, next_tier
  - Supports optional `company_id` filter for company-specific volumes

---

## Remaining Work

### P0 - Critical Stability ✅ VERIFIED
- **API Service Stability**: ✅ `server.py` includes `monitor_services()` that auto-restarts crashed services every 10 seconds
- **Python Wrapper**: Required for supervisor compatibility - working correctly

### P1 - High Priority (Security Framework - IN PROGRESS)
- **2FA Implementation** - DB tables exist, controllers NOT implemented
  - Need: `twoFactorController.ts` with enable/verify/disable/backup codes
  - Need: Integration with login flow
- **Session Management** - DB tables exist, controllers NOT implemented
  - Need: `sessionController.ts` with list/revoke session functionality
- **Rate Limiter Middleware** - Apply rate limits to merchant API routes

### P2 - Medium Priority
- **Referral Business Logic Integration** - Apply referee discount to transaction fees in paymentController
- **Profile & Preferences Feature** - Theme, timezone, profile picture uploads
  - DB tables exist, controllers NOT implemented

---

## Known Issues
1. **Fee Logic Defaults Bug** - BTC should be $7, USDT-TRC20 should be $10 (currently $5)
2. **Missing userReceives < $5 Check** - Full amount should go to admin if user receives < $5
3. **Google Sign-In** - Needs investigation/fix
4. **API Service Instability** - Not managed by supervisor, can crash

---

## Architecture Clarification (January 2026)

### Gas Fee Wallet vs Admin Fee Wallet
The system has a critical architectural distinction between two wallet types:

1. **Gas Fee Wallet** (`tbl_admin_fee_wallet` database table)
   - Purpose: Stores ETH/TRX for funding token (ERC20/TRC20) transfers
   - Used by: `sendingLeftover` function to return residual gas fees
   - Model: `adminFeeModel`

2. **Admin Fee Wallet** (`.env` file variables: `ETH`, `TRX`, etc.)
   - Purpose: Collects admin/platform fees from payments
   - Used by: `sweepNativeAdminFees` function to send collected fees
   - Utility: `getAdminWalletAddress()` from `/app/backend/utils/adminUtils.ts`

**Code References:**
- `sendingLeftover` (line ~2958): Returns leftover gas to Gas Fee Wallet ✅
- `sweepNativeAdminFees` (line ~3057): Sends collected fees to Admin Fee Wallet ✅

---

## Key Integrations
- PostgreSQL (external database)
- Redis (caching/queues)
- Google Cloud KMS (wallet encryption)
- Tatum (blockchain APIs, webhooks)
- APILayer (Tax Data API)
- Brevo (Email)
- Telnyx (SMS)
- BlockBee, Blockchair (Crypto APIs)
- Flutterwave (Payments)
- Veriff (KYC)

---

## Configuration
- Implementation Plan: `/app/backend/DYNOPAY_IMPLEMENTATION_TASKS.txt`
- Environment: `/app/backend/.env`
