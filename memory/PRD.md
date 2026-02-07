# Dynopay - Crypto Payment Processing Platform

## Original Problem Statement
1. Analyze the ETH payment creation process — fix slow API response and missing webhook_url.
2. Architecture cleanup — unify routing between legacyApiRouter.ts and api-service.

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
- Deleted `legacyApiRouter.ts`, replaced with `merchantApiRouter.ts`
- Migrated 5 endpoints from api-service: createPayment, addFunds, useWallet, getCryptoTransaction, getSingleTransaction
- Replaced all HTTP self-calls with direct DB/controller calls
- Removed `/getCurrencyRatesInternal` endpoint (no longer needed)
- Updated `server.py` to only launch main backend
- Zero breaking changes for existing merchants

### Bug Fix: Stale base_currency from encrypted API key (DONE - Dec 2025)
- Root cause: `validateApiKey` in `legacyApiAuthMiddleware.ts` returned `base_currency` from the encrypted API key payload, which was frozen at key creation time (GBP). DB column was updated to USD but the encrypted payload wasn't regenerated.
- Fix: middleware now fetches `base_currency`, `webhook_url`, `webhook_secret` from `tbl_api` DB table (source of truth) and overrides the encrypted payload values.
- Verified: Bozzmail payments now correctly show `base_currency: "USD"` and ETH amount calculated from USD.

### Files Modified
- `backend/routes/merchantApiRouter.ts` (NEW — unified merchant API)
- `backend/routes/index.ts` (updated import)
- `backend/routes/paymentRouter.ts` (removed getCurrencyRatesInternal)
- `backend/middleware/legacyApiAuthMiddleware.ts` (fetch base_currency from DB)
- `backend/server.py` (removed api-service startup)
- `backend/routes/legacyApiRouter.ts` (DELETED)

### Merchant API Endpoints (all at /api/user/*)
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| createUser | POST | x-api-key | Create customer |
| cryptoPayment | POST | x-api-key + JWT | Direct crypto payment (QR + address) |
| createPayment | POST | x-api-key + JWT | Checkout redirect URL |
| addFunds | POST | x-api-key + JWT | Fund wallet via checkout |
| useWallet | POST | x-api-key + JWT | Debit from wallet |
| getBalance | GET | x-api-key + JWT | Wallet balance |
| getTransactions | GET | x-api-key + JWT | Transaction history |
| getSingleTransaction/:id | GET | x-api-key + JWT | Single transaction |
| getCryptoTransaction/:address | GET | x-api-key + JWT | Verify crypto payment |
| getSupportedCurrency | GET | x-api-key | Available currencies |

## Prioritized Backlog
- P2: Delete `backend/api-service/` directory entirely (currently kept for reference)
