# Dynopay - Crypto Payment Processing Platform

## Original Problem Statement
Crypto payment gateway supporting USDT (TRC20/ERC20), USDC (ERC20), ETH, and TRX. Merchants receive crypto payments via Payment Links or Direct API. Platform handles automated settlement, fee splitting, and gas management.

## Architecture
- Python proxy (`server.py`) on port 8001 -> Node.js backend on port 3300
- Redis for state management (keys: `customer-{ref}`, `crypto-{address}`)
- PostgreSQL for persistent data
- Tatum API for blockchain interactions (balance checks, transaction broadcasting)
- FastForex / CoinGecko for currency conversion rates
- Cron jobs: `checkMissedPayments` (5min), `detectOrphanPayments` (10min), `processIncompletePayments`

## What's Been Implemented

### ERC20 Payment Bug Fixes (DONE - Feb 2026)
- Fixed SmartGas `fundGasIfNeeded`: zero-balance wallets now correctly receive gas funding
- Fixed `checkMissedPayments`: failed transactions in Redis are now re-processed
- Added USDC-ERC20 handler in `getIncomingTransactions`
- Recovered 2 stuck payments (USDT-ERC20, USDC-ERC20)
- Files: `merchantPoolMonitoring.ts`, `smartGas.ts`

### Multi-Chain Fee Optimization (DONE - Feb 2026)
- TRON TRC20: Dynamic feeLimit (5-30 TRX) replaces hardcoded 50 TRX
- TRX Native: Dynamic bandwidth-aware fees replace hardcoded 10 TRX
- EVM: Percentage-based gas buffers (15%+0.5 Gwei) replace flat +2 Gwei
- Energy-aware SmartGas: checks staked Energy before funding TRX
- Diagnostics endpoint: GET /diagnostics/fee-optimization
- Files: `tronEnergyService.ts`, `tatumApi.ts`, `blockchainFeeService.ts`, `merchantPoolSweep.ts`

### Direct API vs Payment Link Separation (DONE - Feb 2026)
- Direct API: immediate processing, no grace period, no thresholds
- Payment Links: per-merchant grace period (1-30 min), configurable thresholds
- Files: `webhooks/index.ts`, `paymentController.ts`, `companyController.ts`

### Fallback Safety Nets (DONE - Feb 2026)
- `checkMissedPayments`: reconstructs Redis from `last_payment_context` when Tatum fails 3x
- `processIncompletePayments`: now scans merchant pool addresses too
- Files: `merchantPoolMonitoring.ts`, `paymentController.ts`

### Webhook URL Bug Fix (DONE - Dec 2025)
- `webhook_url` now stored in `crypto-{address}` Redis key (not just `customer-{ref}`)
- Merge fallback logic in webhook handler
- Cached exchange rate performance fix

### Architecture Cleanup (DONE - Feb 2026)
- Deleted `api-service/` directory
- Lightweight API versioning: `/api/v1/*` alongside `/api/*`
- Configurable reservation timeout (120 min, env-driven)
- Orphan payment detection on AVAILABLE addresses

### Admin Fee Residual Fix (DONE - Feb 2026)
- `checkMissedPayments` subtracts `admin_fee_balance` before dust check
- Eliminates false positive "missed payment" alerts

## Current Status
- Backend: Healthy, all cron jobs running
- CRITICAL: ETH Fee Wallet (`0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c`) is DEPLETED
  - All future ERC20 settlements will fail until refilled
  - TRC20 payments unaffected (separate TRX gas wallet)

## Prioritized Backlog
- P0: Refill ETH Fee Wallet (manual user action required)
- No other pending technical tasks
