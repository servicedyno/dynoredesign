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
- **Complete API documentation** with 139 documented endpoints
- **Path Definition Files** created in `/app/backend/swagger/paths/`:
  - `user.ts` - User Management (16 endpoints)
  - `payment.ts` - Payment Processing (17 endpoints) **with realistic request/response examples**
  - `wallet.ts` - Wallet Management (20 endpoints)
  - `admin.ts` - Admin Operations (15 endpoints)
  - `subscription.ts` - Subscriptions (5 endpoints)
  - `apiKeys.ts` - API Keys Management (15 endpoints)
  - `notification.ts` - Notifications (5 new endpoints)
  - `api.ts` & `status.ts` - Auth, Dashboard, Tax, Company, KYC, Status
- **Swagger UI**: Available at `/api/docs`
- **OpenAPI Spec**: Available at `/api/docs.json`
- **Coverage improved**: From 38% to 100%
- **Payment Examples Added**: E-commerce checkout, invoice payment, crypto payment flows with multiple scenarios
- **Webhook Documentation**: 8 merchant webhook payload examples (payment.completed, pending, confirming, partial, expired, failed, refunded) + 3 Tatum internal webhook examples

---

## Remaining Work

### P0 - Critical Stability ✅ VERIFIED
- **API Service Stability**: ✅ `server.py` includes `monitor_services()` that auto-restarts crashed services every 10 seconds
- **Python Wrapper**: Required for supervisor compatibility - working correctly

### P1 - High Priority ✅ VERIFIED
- **Phase 5: Authentication Fixes** ✅ 
  - `forgotPassword` - Sends reset email with secure token
  - `resetPassword` - Validates token and updates password
  - `googleSignIn` - Supports both idToken and accessToken
- **Phase 9: Email Service** ✅ - 18 templates via Brevo (welcome, KYC, payment notifications, etc.)
- **Wallet Configuration** ✅ - Implemented in wallet controller

---

## Known Issues
1. **Fee Logic Defaults Bug** - BTC should be $7, USDT-TRC20 should be $10 (currently $5)
2. **Missing userReceives < $5 Check** - Full amount should go to admin if user receives < $5
3. **Google Sign-In** - Needs investigation/fix
4. **API Service Instability** - Not managed by supervisor, can crash

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
