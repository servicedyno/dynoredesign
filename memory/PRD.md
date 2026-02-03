# Dynopay - Crypto Payment Gateway

## Original Problem Statement
A full-stack crypto payment gateway called "Dynopay" with:
- React frontend + Node.js/TypeScript backend (FastAPI wrapper)
- PostgreSQL database
- Comprehensive API documentation (Swagger)
- Email notification system
- Wallet management system
- Gas funding system for token transfers

## Core Architecture
```
/app
├── backend/
│   ├── apis/         # External API services (Tatum)
│   ├── controller/   # API request handlers
│   ├── middleware/   # Express.js middleware for validation/auth
│   ├── models/       # Sequelize DB models
│   ├── routes/       # API route definitions
│   ├── services/     # Business logic (emailing, gas funding)
│   ├── swagger/      # API documentation files
│   └── server.py     # Python wrapper for the Node.js app
├── frontend/
└── services/
```

## Key Technical Concepts
- **Backend:** Node.js/TypeScript with Express.js, using Sequelize for PostgreSQL
- **Frontend:** React with Tailwind CSS
- **Database:** PostgreSQL
- **Caching:** Dual-layer (Redis + in-memory) - **restart backend to clear in-memory cache**
- **Authentication:** JWT for dashboard, API Keys for programmatic access
- **Services:** supervisor-managed backend and frontend

## Key Database Tables
- `tbl_user`: User information
- `tbl_company`: Company information linked to users
- `tbl_user_wallet`: Primary wallet table
- `tbl_user_api_keys`: API keys linked to companies
- `tbl_merchant_temp_address`: Pool addresses for crypto payments
- `tbl_merchant_wallet`: Merchant xpub/mnemonic per chain

## 3rd Party Integrations
- **Tatum:** Blockchain interaction service
- **Google Cloud Secret Manager:** Secret retrieval
- **PostgreSQL (Railway):** External database
- **Redis (Railway):** External caching

---

## What's Been Implemented

### Session: February 2026

#### UI/UX Design Document for Missing Screens - COMPLETED ✅
**Date:** February 2026

**Document Created:** `/app/UI_UX_DESIGN_REQUEST.md`

**Screens Documented:**
1. **Company Settings** - Webhook notifications + Payment tolerance settings
2. **Create Payment Link** - Crypto selector + Tax toggle
3. **Edit Payment Link** - New screen (copy of Create with edit behaviors)
4. **Payment Links List** - Add Edit button by status
5. **Checkout Page** - Tax breakdown display for customers

**Key Clarifications:**
- Tax is **location-based** (customer's country at checkout), NOT company country
- Merchant only toggles tax ON/OFF per payment link
- Tax rate is automatically detected based on customer IP geolocation
- Supported cryptos: BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20

#### TypeScript Any Removal - COMPLETED ✅
**Date:** February 2026
- Removed ~99% of `any` types from backend codebase
- Created `/app/backend/types/index.ts` for shared interfaces
- Backend compiles and runs without errors

#### Rate Limiting - COMPLETED ✅
**Date:** February 2026
- Applied rate limiters to sensitive auth routes (login, forgot-password)
- Middleware: `/app/backend/middleware/rateLimitMiddleware.ts`

#### VAT Validation - COMPLETED ✅
**Date:** February 2026
- Company country must match VAT ID country
- Implemented in `companyController.ts` for add/update operations

---

### Session: December 2025

#### Gas System Cleanup - COMPLETED ✅
**Date:** December 2025

**Changes Made:**

1. **Fixed `GAS_TOKEN_MAPPING`** (`/app/backend/models/merchantPoolModels/index.ts`)
   - Removed incorrect entries `'ETH': 'ETH'` and `'TRX': 'TRX'`
   - Native currencies don't need external gas funding - they pay from their own balance
   - Only tokens (USDT-TRC20, USDT-ERC20, USDC-ERC20) now in mapping

2. **Removed `recoverStrandedGas` function** (`/app/backend/services/merchantPoolService.ts`)
   - Deleted ~180 lines of unnecessary recovery code
   - This function was incorrectly attempting to recover gas from addresses

3. **Removed gas recovery cron job** (`/app/backend/server.ts`)
   - Removed hourly cron that called `recoverStrandedGas`
   - Eliminates unnecessary blockchain queries and error logs

4. **Cleaned up `dist/` folder**
   - Removed stale compiled JavaScript files

**Previous Session Completions:**
- Initial setup and dependency installation
- Data management APIs for merchants/companies
- Email notification system with Dynopay branding
- API documentation audit (Swagger)
- Wallet management bug fixes (caching, OTP logic, data retrieval)
- Deployment fixes (hardcoded env variables)

---

## Prioritized Backlog

### P1 - High Priority
1. **Import Wallets UI:** Build frontend feature for merchants to import wallets from another company (backend logic exists)

### P2 - Medium Priority
1. **Cache Consolidation:** Refactor dual caching (Redis + in-memory) to single Redis-based cache for predictability
2. **URL Shortener:** Consider dedicated URL shortener service for payment links

### P3 - Low Priority
1. Additional code cleanup (linting, unused imports, etc.)

---

## Test Credentials
- **Merchant 1:** `richard@dyno.pt`, Password: `Katiekendra123@`
- **Merchant 2:** `nomadly@moxx.co`, Password: `Katiekendra123@`

---

## Critical Notes for Future Development
1. **Dual Cache:** Backend MUST be restarted (`sudo supervisorctl restart backend`) to clear in-memory cache
2. **Gas System:** Only tokens need gas funding - native currencies handle their own fees
3. **No Gas Recovery:** The system does not have gas recovery logic - gas is only funded when needed for token transfers
4. **Subscriptions:** Tatum webhooks are updated on address reservation with company info
