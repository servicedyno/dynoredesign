# Dynopay - Crypto Payment Processing Platform

## Original Problem Statement
Analyze the ETH payment creation process. Key issues reported:
1. API response for creating a payment was slow (double currency conversion).
2. `webhook_url` was not being registered, leading to failed merchant notifications.

## Architecture
- Python proxy (`server.py`) → TypeScript backend (port 3300) + api-service
- Redis for state management (payment keys: `customer-{ref}`, `crypto-{address}`)
- PostgreSQL for persistent data
- Tatum for crypto webhook notifications
- FastForex / CoinGecko for currency conversion rates

## What's Been Implemented

### Bug Fix: Webhook URL not registered (DONE - Dec 2025)
- `webhook_url` now correctly propagated and stored in `crypto-{address}` Redis key
- Webhook handler retrieves URL from fallback key
- Files: `backend/routes/crypto.ts`, `backend/routes/paymentLinks.ts`, `backend/webhooks/tatum.ts`

### Bug Fix: Slow payment creation (DONE - Dec 2025)
- Root cause: redundant `currencyConvert` call in `createCryptoPayment`
- Fix: Cache exchange rate in `legacyApiRouter.ts`, pass via Redis payload
- `createCryptoPayment` now checks for `cached_transfer_rate` and skips second API call
- Verified: `hasCached=true`, "saved ~200ms" confirmed in logs
- Files: `backend/routes/legacyApiRouter.ts`, `backend/routes/crypto.ts`

## Prioritized Backlog
- P2: Architecture cleanup — clarify routing split between `legacyApiRouter.ts` and `api-service`
