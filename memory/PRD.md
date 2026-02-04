# DynoPay - Crypto Payment Platform PRD

## Original Problem Statement
Build and maintain a full-stack cryptocurrency payment platform allowing merchants to accept crypto payments with multi-tenant support, payment links, and flexible fee structures.

## Core Requirements
1. Merchant dashboard for managing payments and wallets
2. Payment link creation with customizable options
3. Multi-cryptocurrency support (BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-ERC20)
4. Selectable currencies per payment link
5. Fee payer options (merchant or customer)
6. Webhook notifications for payment events
7. API key management for merchant integrations

## Architecture
- **Backend**: Express.js with TypeScript, PostgreSQL, Sequelize ORM
- **Frontend**: React (Merchant Dashboard)
- **Checkout**: Next.js (CheckoutDyno repo)
- **Services**: Redis for caching, Tatum for blockchain APIs
- **Security**: JWT authentication, rate limiting

## What's Been Implemented

### Session: February 4, 2026 (Latest)

#### API Documentation Improvements
- ✅ Consolidated tags from 25+ down to 24 logical groups
- ✅ Better organization: Authentication → Merchant Setup → Payments → Transactions → Integrations → Platform
- ✅ Added `available_currencies` documentation to `getData` response
- ✅ Updated `configured-currencies` endpoint to explain `accepted_currencies` filtering
- ✅ Added examples showing currency restrictions in action

#### Checkout Repo Analysis (CheckoutDyno)
- ✅ **Consistent**: `getData` response structure matches checkout expectations
- ✅ **Consistent**: `configured-currencies` endpoint provides filtered currencies
- ✅ **Consistent**: Fee handling (`fee_payer`, `feeInfo`) matches
- ✅ **Consistent**: Tax handling (`taxInfo`) matches
- ✅ **Consistent**: Payment timing settings match
- ✅ **No fixes required**: Checkout repo is compatible with backend

#### Currency Selection Architecture Fix
- ✅ `getConfiguredCurrenciesForCheckout` now respects `accepted_currencies`
- ✅ `getData` endpoint returns `available_currencies` in response
- ✅ Direct API endpoints support `accepted_currencies` parameter
- ✅ 22/22 currency tests passing (100% success rate)

#### Code Cleaning
- ✅ Fixed all TypeScript compilation errors
- ✅ All files pass `yarn tsc --noEmit` with 0 errors

### Previous Sessions
- ✅ Webhook Enhancements with detailed payloads
- ✅ Onboarding Status Endpoint (`GET /api/user/onboarding-status`)
- ✅ KYC Enforcement Logic ($10K threshold, 90-day grace period)
- ✅ In-App KYC Warnings with Veriff session URLs

## Currency Selection Flow

| Step | Endpoint | Behavior |
|------|----------|----------|
| 1. Create Link | `POST /api/pay/createPaymentLink` | Stores `accepted_currencies` in DB + Redis |
| 2. Load Checkout | `POST /api/pay/getData` | Returns `available_currencies` if restrictions set |
| 3. Get Currencies | `GET /api/pay/configured-currencies` | Returns ONLY currencies from `accepted_currencies` |
| 4. Make Payment | `POST /api/pay/createCryptoPayment` | Validates currency is in allowed list |

## API Documentation Tags (Reorganized)

### Authentication & User
- Authentication
- User Management

### Merchant Setup
- Company
- Wallet Address Management
- API Keys
- KYC Verification

### Payments
- Payments (link creation/management)
- Payment Processing (checkout flow)
- Direct API - Merchant Integration

### Transactions & Reports
- Transactions
- Dashboard
- Subscriptions

### Integrations
- Webhooks
- Tax
- Notifications

### Platform
- Status
- Knowledge Base
- Admin

## Checkout Repo Compatibility

**Repo:** https://github.com/Moxxcompany/CheckoutDyno/

**API Calls Used:**
1. `POST /api/pay/getData` ✅
2. `POST /api/pay/getCurrencyRates` ✅
3. `GET /api/pay/configured-currencies` ✅
4. `POST /api/pay/addPayment` ✅
5. `POST /api/pay/verifyCryptoPayment` ✅

**Status:** All endpoints compatible, no changes required in checkout repo.

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Currency selection fix~~ ✅ COMPLETE
- [x] ~~API documentation update~~ ✅ COMPLETE
- [x] ~~Checkout compatibility check~~ ✅ VERIFIED

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements

### P2 (Medium)
- [ ] High effort code cleaning (standardize logger, refactor duplicated logic)
- [ ] Security monitoring dashboards

## Key API Endpoints
- `POST /api/pay/createPaymentLink` - Create payment link with currency restrictions
- `POST /api/pay/getData` - Get payment data including `available_currencies`
- `GET /api/pay/configured-currencies` - Get filtered currencies for checkout
- `GET /api/user/onboarding-status` - Merchant onboarding status
- `GET /api/docs` - Swagger API documentation

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

## Test Reports
- Latest: `/app/test_reports/iteration_3.json` (22 tests, 100% pass rate)
