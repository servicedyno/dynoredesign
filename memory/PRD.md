# DynoPay Crypto Payment Gateway - PRD

## Original Problem Statement
Cryptocurrency payment gateway (Node.js/TypeScript) using Tatum SDK for blockchain interactions. The platform processes crypto payments for merchants, handles admin fee collection, and manages payment addresses via a "Merchant Pool" system with "SmartGas" auto-funding for token transfers.

## Architecture
- **Backend:** Node.js, TypeScript
- **Crypto Integration:** Tatum SDK (mixed v3/v4 usage)
- **Database:** PostgreSQL (via Sequelize), Redis (caching/locking)
- **Architecture:** Monolithic backend with cron jobs for missed payment monitoring

## What's Been Implemented

### Session 1 (Previous)
- XRP fee logic correction (reserve values updated)
- SOL/XRP payment detection fixes (chain names, RPC fallbacks)
- USDT-POLYGON payment processing (gas price cap removal)
- Missing confirmation handlers for SOL, XRP, POLYGON
- Payment type path fix in missed payment processing

### Session 2 (2026-02-10)
1. **USDT-POLYGON Payment Recovery** - Recovered stuck tx (100 Gwei was too low during 500+ Gwei spike). Replacement tx confirmed in block 82784671. 7.6021 USDT + 3.3279 admin fee swept.
2. **Polygon Gas Price Fix (ROOT CAUSE)** - Removed 100 Gwei cap in `feeEstimation`. Added RPC gas price fallback for real-time pricing with 25% buffer. Applied to both single and batch fee estimation.
3. **"Audit Test Co" Email Bug Fix** - Root cause: `pendingPaymentService.ts` JOIN query returned first company (Audit Test Co) for multi-company users without company_id filter. Fixed all 4 query instances.
4. **Customer Transaction Status Bug Fix** - `where: { transaction_id: customerPayload.id }` used UUID against INTEGER column. Fixed to `where: { id: customerPayload.id }`. Batch-updated 29 stuck "processing" records.
5. **WXRP (XRP-ERC20) Token Recovery** - 8.34057243 WXRP recovered from payment address to admin wallet. Confirmed in block 24423469.
6. **Config Updates** - `POLYGON_GAS_FALLBACK` increased from 0.01 to 0.05 POL.

## Files Modified (Session 2)
- `apis/tatumApi.ts` - Polygon gas price RPC fallback, removed 100 Gwei cap
- `services/pendingPaymentService.ts` - company_id filter in 4 user+company JOIN queries
- `controller/paymentController.ts` - Fixed customer_transaction status update (id vs transaction_id)
- `services/merchantPool/merchantPoolConfig.ts` - POLYGON_GAS_FALLBACK 0.01 → 0.05

## Remaining Tasks

### P0
- None critical remaining

### P1
- USDT-TRC20 sweep ($3.63 admin fee) - currently not profitable ($2.20 gas > 50% threshold)
- RLUSD trust line creation bug (Tatum SDK error)

### P2
- BCH live testing
- Native RLUSD live testing
- RLUSD-ERC20 contract mismatch (configured: 0x8292..., actual on mainnet needs verification)

### P3 (Refactoring)
- tatumApi.ts Strategy Pattern refactor for chain-specific logic
- Abstract "SDK fallback to RPC" pattern
- Harden checkMissedPayments.ts data reconstruction

## Key Technical Notes
- **MUST COMPILE:** Run `npx tsc` after any TypeScript changes
- **TATUM SDK UNRELIABLE:** Always validate output, use RPC fallbacks
- **NONCE MANAGEMENT:** EVM chains prone to stuck txs; monitor gas prices
- **XRP ADMIN WALLET:** Requires destinationTag: 251101560
- **POLYGON GAS:** Can spike to 500-1000+ Gwei; RPC fallback essential
