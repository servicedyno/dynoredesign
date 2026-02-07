# Dynopay - Crypto Payment Processing Platform

## Original Problem Statement
1. Analyze the ETH payment creation process — fix slow API response and missing webhook_url.
2. Architecture cleanup — unify routing between legacyApiRouter.ts and api-service.
3. Analyze and fix payment link update flow for all fields.

## Architecture
- Python proxy (`server.py`) on port 8001 → Node.js backend on port 3300
- All merchant API endpoints served by `merchantApiRouter.ts` (unified)
- Redis for state management (keys: `customer-{ref}`, `crypto-{address}`)
- PostgreSQL for persistent data
- Tatum for crypto webhook notifications
- FastForex / CoinGecko for currency conversion rates

## What's Been Implemented

### Bug Fix: Webhook URL not registered (DONE - Dec 2025)
- `webhook_url` now correctly propagated and stored in `crypto-{address}` Redis key
- Files: `backend/routes/crypto.ts`, `backend/routes/paymentLinks.ts`, `backend/webhooks/tatum.ts`

### Bug Fix: Slow payment creation (DONE - Dec 2025)
- Cached exchange rate in merchantApiRouter, passed via Redis to skip redundant currencyConvert call
- Verified: `hasCached=true`, "saved ~200ms" confirmed in logs

### Architecture: Unified Merchant API (DONE - Dec 2025)
- Retired `api-service` (separate Node.js process on port 3301) — no longer started
- Created `merchantApiRouter.ts` with all 10 merchant endpoints
- Replaced HTTP self-calls with direct DB/controller calls
- Zero breaking changes for existing merchants

### Bug Fix: Stale base_currency from encrypted API key (DONE - Dec 2025)
- Middleware now fetches `base_currency`, `webhook_url`, `webhook_secret` from `tbl_api` DB (source of truth)

### Bug Fix: Payment Link Update — 4 Issues Fixed (DONE - Dec 2025)
1. **`customer_name` not updatable**: Added `name` field handling in `updatePaymentLink`, stored as `customer_name` in both DB and Redis
2. **Stale `amount` in Redis**: Now syncs `amount` alongside `base_amount` during update
3. **Redis key expiry breaks link**: When Redis key is missing during update, reconstructs full payload from DB + wallet config, flagged with `reconstructed: true`
4. **`crypto-{address}` stale data**: After updating `customer-{ref}`, also updates `webhook_url` and `callback_url` on active `crypto-{address}` key if payment is pending

Files modified: `backend/controller/paymentController.ts`

## Prioritized Backlog
- P2: Delete `backend/api-service/` directory entirely (currently kept for reference)
- P2: API versioning (`/api/v2/user/*`) for future evolution
