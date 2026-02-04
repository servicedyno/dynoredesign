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
- **Frontend**: React
- **Services**: Redis for caching, Tatum for blockchain APIs
- **Security**: JWT authentication, rate limiting

## What's Been Implemented

### Session: February 4, 2026 (Latest)
- ✅ **Currency Selection Architecture Fix**: Fixed critical inconsistencies in how `accepted_currencies` is enforced
  - `getConfiguredCurrenciesForCheckout` now reads `accepted_currencies` from payment link and filters results
  - `getData` endpoint now returns `available_currencies` in response for frontend to use
  - Direct API endpoints (`/user/cryptoPayment`, `/user/createPayment`) now support `accepted_currencies` parameter
  - Payment validation correctly rejects currencies not in the allowed list
  - All 22 currency tests passing (100% success rate)
  
- ✅ **Code Cleaning Completed**: Fixed all TypeScript compilation errors
  - Fixed broken imports (IUserType, walletMiddleware) removed by previous cleanup
  - Fixed property name mismatch (contractAddress → _contractAddress)
  - Fixed undeclared variable (blockchainBuffer) in fee calculation
  - Fixed undefined variable (responseBody) in API usage logger
  - All files now pass `yarn tsc --noEmit` with 0 errors

### Session: January-February 2026
- ✅ **Webhook Enhancements**: Added detailed fields (merchant_amount, total_fee, customer_name, payment_type) to all payment webhooks
- ✅ **API Documentation Overhaul**: Created dedicated Webhooks section in Swagger docs with comprehensive payload examples
- ✅ **Onboarding Status Endpoint**: `GET /api/user/onboarding-status` provides consolidated merchant onboarding status
- ✅ **KYC Enforcement Logic**: $10,000 volume threshold with 90-day grace period for KYC compliance
- ✅ **In-App KYC Warnings**: Dynamic warnings in API responses with Veriff session URLs
- ✅ **100% TypeScript Type Safety**: 482 → 0 errors achieved
- ✅ **Full Backend Regression**: All endpoints verified working

### Previous Sessions
- ✅ UI/UX Design Document created (`/app/UI_UX_DESIGN_REQUEST.md`)
- ✅ Accepted Currencies per Payment Link feature (backend complete)
- ✅ Full merchant/company/payment/wallet CRUD operations

## Currency Selection Flow (Fixed)

| Step | Endpoint | Behavior |
|------|----------|----------|
| 1. Create Link | `POST /api/pay/createPaymentLink` | Stores `accepted_currencies` in DB and Redis as `available_currencies` |
| 2. Load Checkout | `POST /api/pay/getData` | Returns `available_currencies` array to frontend |
| 3. Get Currencies | `GET /api/pay/configured-currencies` | Returns ONLY currencies from `accepted_currencies` (not all wallets) |
| 4. Make Payment | `POST /api/pay/createCryptoPayment` | Validates currency is in `available_currencies` list |

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Fix all TypeScript errors~~ ✅ COMPLETE
- [x] ~~Code cleaning (medium effort)~~ ✅ COMPLETE
- [x] ~~Currency selection architecture fix~~ ✅ COMPLETE

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements per `/app/UI_UX_DESIGN_REQUEST.md`

### P2 (Medium)
- [ ] High effort code cleaning (standardize logger usage, refactor duplicated logic)
- [ ] Security monitoring dashboards
- [ ] Enhanced logging and alerting

## Key API Endpoints
- `GET /api/user/onboarding-status` - Consolidated onboarding status with KYC warnings
- `POST /api/pay/createPaymentLink` - Create payment link with currency restrictions
- `POST /api/pay/getData` - Get payment link data including `available_currencies`
- `GET /api/pay/configured-currencies` - Get currencies filtered by `accepted_currencies`
- `POST /api/pay/createCryptoPayment` - Create crypto payment (validates currency)
- `POST /api/user/cryptoPayment` - Direct API payment with `accepted_currencies` support
- `GET /api/pay/company-currencies/:id` - Get all currencies with configuration status
- `PUT /api/pay/links/:id` - Update payment link including `accepted_currencies`
- `GET /api/docs` - Swagger API documentation

## Database Schema (Key Tables)
- `tbl_payment_links`: { link_id, company_id, amount, currency, accepted_currencies, fee_payer }
- `tbl_company`: { company_id, user_id, company_name, webhook_url }
- `tbl_user_wallet`: { wallet_id, user_id, company_id, wallet_type, wallet_address }
- `tbl_kyc_verifications`: { kyc_id, user_id, company_id, status, veriff_session_url, threshold_reached_at }
- `tbl_webhook_delivery_log`: { log_id, webhook_url, event_type, payload, status }

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
- Admin: admin@dynopay.io / password123

## Test Reports
- Latest: `/app/test_reports/iteration_3.json` (22 tests, 100% pass rate)
- Currency Selection: All flows verified working
- TypeScript: 0 compilation errors

## Key Files Modified (Currency Fix)
- `controller/paymentController.ts` - getData returns available_currencies, getConfiguredCurrenciesForCheckout filters by accepted_currencies
- `api-service/controller/index.ts` - cryptoPayment and createPayment support accepted_currencies parameter
