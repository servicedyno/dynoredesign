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
│   ├── services/     # Business logic (emailing, gas recovery)
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

### Session: December 2025

#### Gas System Fix (P0) - COMPLETED ✅
**Date:** December 2025

**Problem:** The `GAS_TOKEN_MAPPING` incorrectly included native currencies (ETH, TRX), causing:
- Unnecessary gas funding attempts for native currencies
- Error logs from failed operations
- Wasted blockchain queries

**Fix Applied:**
- Removed `'ETH': 'ETH'` and `'TRX': 'TRX'` from `GAS_TOKEN_MAPPING`
- Added documentation explaining why only tokens need gas funding
- File modified: `/app/backend/models/merchantPoolModels/index.ts`

**Technical Explanation:**
- Native currencies (ETH, TRX) pay transaction fees from their own balance
- Only tokens (USDT-TRC20, USDT-ERC20, USDC-ERC20) need external gas funding
- The `fundGasIfNeeded` function now correctly skips native currencies with "No gas token mapping" reason

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
1. General code cleanup and documentation updates

---

## Test Credentials
- **Merchant 1:** `richard@dyno.pt`, Password: `Katiekendra123@`
- **Merchant 2:** `nomadly@moxx.co`, Password: `Katiekendra123@`

---

## Critical Notes for Future Development
1. **Dual Cache:** Backend MUST be restarted (`sudo supervisorctl restart backend`) to clear in-memory cache
2. **Gas System:** Only tokens need gas funding - native currencies handle their own fees
3. **Subscriptions:** Tatum webhooks are updated on address reservation with company info
