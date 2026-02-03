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

### Session: February 3, 2026
- ✅ **100% TypeScript Type Safety Achieved**: 482 → 0 errors (COMPLETE)
  - All 34 remaining errors fixed in this session
  - Files fixed: `tatumApi.ts`, `apiController.ts`, `companyController.ts`, `index.ts`, `invoiceController.ts`, `subscriptionController.ts`, `walletController.ts`, `encryption.ts`, `apiUsageLogger.ts`, `testRouter.ts`, `server.ts`, `merchantPoolService.ts`, `swagger/index.ts`, `adminFeeMultiTenancy.test.ts`, `cronJobs.ts`, `geolocation.ts`, `webhooks/index.ts`
- ✅ **Full Backend Regression Test Passed**: 26/26 tests (100% success rate)
  - All API endpoints verified working
  - Authentication, company, payment, wallet, dashboard, referral, knowledge base endpoints all functional
- ✅ **Removed Legacy Code**: Deleted unused `usdtPoolService.ts`
- ✅ **Fixed Data Audit Script**: `/app/audit_vat_data_quality.py` now uses correct database env vars

### Session: December 2025 (Previous)
- ✅ UI/UX Design Document created (`/app/UI_UX_DESIGN_REQUEST.md`)
- ✅ **Accepted Currencies per Payment Link** feature (backend complete)
- ✅ **TypeScript Error Reduction**: 482 → 34 errors (initial work)

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Fix all TypeScript errors~~ ✅ COMPLETE (0 errors)
- [x] ~~Full backend regression test~~ ✅ COMPLETE (100% pass rate)

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements per `/app/UI_UX_DESIGN_REQUEST.md`

### P2 (Medium)
- [ ] Security monitoring dashboards
- [ ] Enhanced logging and alerting

## Key API Endpoints
- `POST /api/pay/links` - Create payment link
- `PUT /api/pay/links/:id` - Update payment link
- `GET /api/pay/links/:id` - Get payment link details
- `GET /api/pay/company-currencies/:company_id` - Get company's configured wallets
- `GET /api/user/login` - User authentication
- `GET /api/company/getCompany` - Get company list
- `GET /api/wallet/getWallet` - Get wallet info

## Database Schema (Key Tables)
- `tbl_payment_links`: { link_id, company_id, amount, currency, accepted_currencies, fee_payer }
- `tbl_company`: { company_id, user_id, company_name, webhook_url }
- `tbl_user_wallet`: { wallet_id, user_id, company_id, wallet_type, wallet_address }

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38

## Test Reports
- Latest: `/app/test_reports/iteration_2.json` (26 tests, 100% pass rate)
