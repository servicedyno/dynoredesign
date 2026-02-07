# DynoPay - Product Requirements Document

## Original Problem Statement
Crypto payment processing platform (DynoPay) with full-stack monolith: React frontend + Express/TypeScript backend + PostgreSQL + Redis.

## Core Requirements
- API key management with currency rules (one per env, production is master)
- End-to-end currency consistency across dashboard, transactions, wallets, emails, PDFs
- FIAT currency restriction (14 supported currencies)
- Redis-only caching (consolidated from dual in-memory + Redis)
- Consistent currency info objects in API responses
- Token expiry headers on authenticated routes
- Active API key enforcement for payment link creation

## User Personas
- **Merchants**: Create payment links, manage API keys, receive crypto payments
- **Customers**: Pay via crypto through generated payment links

## Architecture
- **Backend**: Express + TypeScript (ts-node), port 3300
- **Frontend**: React, port 3000
- **Database**: PostgreSQL with Sequelize ORM
- **Cache**: Redis (single layer)
- **Auth**: JWT (user session + Admin Token)

## Key DB Schema
- `tbl_api`: `{ api_id, company_id, base_currency, status, environment, admin_token }`
- `tbl_user_transactions`: `{ base_amount, base_currency, usd_value }`
- `tbl_companies`: `{ company_id, company_name, user_id }`

## What's Been Implemented
- Auto-generated friendly names for API keys/wallets
- End-to-end currency consistency (dashboard, transactions, wallets, emails, PDFs)
- API key management: one per env, production master, FIAT restriction, dev auto-sync
- Cache consolidation to Redis-only
- Token expiry header (`X-Token-Expires-In-Days`)
- Available currencies endpoint per company
- **Active API key check on payment link creation** (completed 2026-02-06)
- **Transaction display currency fix** (completed 2026-02-06): crypto amounts (ETH/BTC) now correctly convert to company's preferred fiat currency in getTransactions endpoint. Fixed both companyController.ts (was hardcoding USD source) and currencyConvert.ts (CoinGecko now tried first for crypto conversions)
- **Admin fee email redesign** (completed 2026-02-06): Improved Platform Fee Received email to match merchant-facing email quality. Added Status badge ("Processed"), Date row, em-dash subject line. Fixed logo rendering by switching from SVG (clip-path unsupported in Gmail) to PNG served from backend static files.
- **Merchant configuration for nomadly@moxx.co** (completed 2026-02-06): Configured crypto wallets for payment forwarding, initialized merchant pool, regenerated API key with USD currency.
- **Payment logic fix** (completed 2026-02-06): Fixed incorrect wallet_id reference during payment creation in walletController.ts.
- **Webhook logic fix** (completed 2026-02-06): Fixed `callMerchantWebhook` in `webhooks/index.ts` to read `webhook_url` from `customerData` (Redis) first — critical for the merchant crypto payment API (`POST /api/user/cryptoPayment`) which passes webhook_url per-payment but doesn't create a `tbl_payment_link` record. Also fixed reference to non-existent `payment_link_id` column (uses `link_id`). Lookup chain: customerData (Redis) → tbl_payment_link → tbl_company → tbl_api.

## Orphan Payment Feature (completed 2026-02-07)
- **Configurable Reservation Timeout**: Address reservation timeout now configurable via `RESERVATION_TIMEOUT_MINUTES` env var (set to 120 minutes)
- **Orphan Payment Detection**: `detectOrphanPayments` cron job scans AVAILABLE addresses for late payments using preserved `last_payment_context`
- **Payment Context Preservation**: `last_payment_context` JSONB column on `tbl_merchant_pool_addresses` preserves payment details after address expiry
- **Build fix**: Fixed TypeScript errors in `detectOrphanPayments` — `ref` property inclusion in object literal, `tempAddressId` camelCase, and `recordPoolTransaction` call signature alignment
- **E2E Tests**: 3/3 passing — context preservation, orphan detection scan, context cleanup
- **Refactor (completed 2026-02-07)**: Split 2800-line `merchantPoolService.ts` into 6 focused modules under `services/merchantPool/`:
  - `merchantPoolConfig.ts` (175 lines) — constants, config, types, withRetry
  - `merchantPoolWallet.ts` (214 lines) — wallet creation, address generation, pool init
  - `merchantPoolReservation.ts` (580 lines) — reservation, release, payment tracking
  - `merchantPoolSweep.ts` (624 lines) — gas funding, sweep execution, scheduled sweeps
  - `merchantPoolTransaction.ts` (112 lines) — transaction recording, pool status
  - `merchantPoolMonitoring.ts` (822 lines) — subscriptions, missed payments, orphan detection
  - `merchantPoolService.ts` (111 lines) — backward-compatible re-export hub

## Currency Utils Consolidation (completed 2026-02-07)
- Added `convertToUSD`, `convertToCrypto`, `convertToFiat`, `convertToMultiple` helpers to `currencyUtils.ts`
- Replaced boilerplate `currencyConvert({...})` calls across: walletController, companyController, dashboardController, adminController, merchantPoolSweep
- Remaining 14 calls in paymentController are complex crypto rate calculations in production payment flows (intentionally preserved)

## Legacy/Modern Payment Path Unification (completed 2026-02-07)
- Eliminated HTTP self-calls in `legacyApiRouter.ts` (was calling itself via `axios.post` to `getCurrencyRatesInternal` and `createCryptoPayment`)
- Replaced rate HTTP call with direct `convertToMultiple` import
- Replaced payment creation HTTP call with direct `paymentController.createCryptoPayment` call via mock req/res
- Removed `axios` dependency and `getBackendURL` helper from legacyApiRouter

## base_currency Decoupling (completed 2026-02-07)
- Created `getCompanyBaseCurrency(companyId)` utility in `currencyUtils.ts`
- Replaced 6 duplicated query + parse blocks across walletController (2), companyController (1), dashboardController (2) with single function call
- Handles null/undefined companyId, query failures, and missing results with 'USD' fallback

## Webhook E2E Verification (completed 2026-02-07)
- Created `tests/test_webhook_e2e.ts` with 4 E2E tests using live webhook.site endpoints
- Test 1: Basic delivery (payload fields, headers, user-agent)
- Test 2: HMAC-SHA256 signed webhook (signature generation + verification)
- Test 3: Callback + webhook dual delivery
- Test 4: DB delivery log persistence (tbl_webhook_delivery_log)
- All 4 tests pass with real HTTP delivery to external endpoint

## End-to-End Preferred Currency (completed 2026-02-07)
- **Invoice**: Uses `getCompanyBaseCurrency` to display amounts in merchant's preferred fiat (GBP, EUR, etc.) instead of hardcoded USD
- **CSV Export**: Column header and values now use preferred currency with conversion rate
- **User Analytics**: `revenue_performance` converts to preferred currency; response includes `display_currency` field
- **Webhook Payloads**: Enriched with `base_amount`, `base_currency`, `exchange_rate` in merchant's preferred fiat (non-blocking fallback if conversion fails)
- All changes preserve backward compat (`amount_in_usd`, `fee_in_usd` fields kept alongside new `amount_in_fiat`, `fee_in_fiat`)

## Backlog

### P1 - Upcoming
- Public/unauthenticated endpoint for payment link creation (x-api-key header auth)
- Auto-create default company + USD API key on new user registration

### P2 - Future
- Update frontend components to consume `currency_info` objects from backend
- Migrate remaining 14 `currencyConvert` calls in paymentController to utility helpers (requires deeper payment flow testing)

## Test Credentials
- Email: richard@dyno.pt / nomadly@moxx.co
- Password: Katiekendra123@
- Company with active API keys: company_id=38
- Nomadly API Key (USD): U2FsdGVkX18eXwAdHb7/EmrlNlzdvYrBRgCA2ayCe/WmtvG8eQ61tNLDXbMW8lFuZYyMgG+NzZ5ay0eGRuwqftP5ONh0huQ2B1+/sIitHvS2spZl4oJRK9+Wl5sYNjMrEADgdzHjfggd85iWEtbufOIENOMHXWCSmH5QObeLcVI=
