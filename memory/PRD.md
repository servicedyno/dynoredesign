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
- ✅ **Code Cleaning Completed**: Fixed all TypeScript compilation errors
  - Fixed broken imports (IUserType, walletMiddleware) removed by previous cleanup
  - Fixed property name mismatch (contractAddress → _contractAddress)
  - Fixed undeclared variable (blockchainBuffer) in fee calculation
  - Fixed undefined variable (responseBody) in API usage logger
  - Fixed template variable reference (_showImage) in sendEmail helper
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

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Fix all TypeScript errors~~ ✅ COMPLETE
- [x] ~~Code cleaning (medium effort)~~ ✅ COMPLETE

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
- `POST /api/pay/createPaymentLink` - Create payment link with KYC enforcement
- `POST /api/user/cryptoPayment` - Direct API crypto payment with KYC enforcement
- `POST /api/kyc/submit` - Initiate KYC verification with Veriff
- `POST /api/pay/links` - Create payment link
- `PUT /api/pay/links/:id` - Update payment link
- `GET /api/pay/links/:id` - Get payment link details
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
- Latest: Backend operational, all endpoints verified working
- TypeScript: 0 compilation errors

## Key Files Modified (Code Cleaning)
- `middleware/adminAuthMiddleware.ts` - Restored IUserType import
- `middleware/authMiddleware.ts` - Restored IUserType import
- `middleware/apiUsageLogger.ts` - Fixed responseBody declaration
- `routes/index.ts` - Restored walletMiddleware import
- `controller/paymentController.ts` - Fixed _contractAddress and blockchainBuffer
- `controller/walletController.ts` - Fixed _contractAddress property
- `api-service/helper/sendEmail.ts` - Fixed _showImage reference
