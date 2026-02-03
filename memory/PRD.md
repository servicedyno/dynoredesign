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

### Session: December 2025
- ✅ UI/UX Design Document created (`/app/UI_UX_DESIGN_REQUEST.md`)
- ✅ Email sent to design team with requirements
- ✅ **Accepted Currencies per Payment Link** feature:
  - Database schema updated (tbl_payment_link.accepted_currencies)
  - API endpoints: POST/PUT /api/pay/links, GET /api/pay/company-currencies/:company_id
  - Swagger documentation updated
  - Feature defaults to all company wallets if not specified
- ✅ **TypeScript Error Reduction**: 482 → 139 errors (71% reduction / 343 errors fixed)
  - Completely fixed: `paymentController.ts`, `merchantPoolService.ts`, `webhooks/index.ts`, `tatumApi.ts`, `api-service/controller/index.ts`
  - Partially fixed: `pendingPaymentService.ts`, `cronJobs.ts`, `adminController.ts`, `dashboardController.ts`, `companyController.ts`, `veriffService.ts`, `monitoringService.ts`, `walletController.ts`, `testRouter.ts`
  - Added type interfaces: `ITemporaryAddress`, `PaymentLinkData`, `PaymentUserJwtPayload`, `CustomerJwtPayload`

## Prioritized Backlog

### P0 (Critical)
- [ ] Fix remaining 139 TypeScript errors to achieve 100% type safety
  - referralController.ts (14 errors)
  - kycController.ts (12 errors)
  - userController.ts (11 errors)
  - walletController.ts (10 errors)
  - controller/index.ts (10 errors)
  - Other services and controllers

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options
- [ ] Payment link management UI improvements

### P2 (Medium)
- [ ] Fix `/app/audit_vat_data_quality.py` database connection
- [ ] Security monitoring dashboards
- [ ] Enhanced logging and alerting

## Key API Endpoints
- `POST /api/pay/links` - Create payment link
- `PUT /api/pay/links/:id` - Update payment link
- `GET /api/pay/links/:id` - Get payment link details
- `GET /api/pay/company-currencies/:company_id` - Get company's configured wallets

## Database Schema (Key Tables)
- `tbl_payment_links`: { link_id, company_id, amount, currency, accepted_currencies, fee_payer }
- `tbl_company`: { company_id, user_id, company_name, webhook_url }
- `tbl_user_wallet`: { wallet_id, user_id, company_id, wallet_type, wallet_address }

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
