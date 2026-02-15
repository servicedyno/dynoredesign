# DynoPay - Crypto Payment Processing Platform

## Original Problem Statement
Full-stack crypto payment processing system with FastAPI proxy + Node.js/TypeScript backend + React frontend + PostgreSQL. Uses Tatum for blockchain interactions and Binance for crypto-to-stablecoin swaps. SOCKS5 proxy via SSH tunnel to German VPS for Binance geo-restriction bypass.

## Architecture
- **Backend**: Node.js/TypeScript (port 3300) behind Python FastAPI proxy (port 8001)
- **Frontend**: React (port 3000)  
- **Database**: PostgreSQL (Railway)
- **Cache**: Redis (Railway)
- **APIs**: Tatum (blockchain), Binance (conversions)
- **Proxy**: SOCKS5 SSH tunnel to 95.179.167.16 (Binance access)

## What's Been Implemented

### Session Feb 14-15, 2026: Security Audit Fixes

**P0 - SQL Injection Fixes (6 locations)**
- `walletController.ts` line 301: Parameterized `wallet_id`, `column`, `sortType`, `offset`, `limit` via Sequelize replacements
- `walletController.ts` line 511: Parameterized WHERE conditions (`date_from`, `date_to`, `status`, `currency`, `search`, `company_id`) + whitelisted ORDER BY columns
- `walletController.ts` line 4057: Parameterized transaction detail query (`id`, `company_id`, `user_id`)
- `walletController.ts` line 4203: Parameterized export query (same pattern as 511)
- `companyController.ts` line 662: Parameterized `company_id` in getTransactions
- `adminController.ts` line 644: Parameterized + whitelisted ORDER BY columns

**P0 - TLS Verification Fix**
- `dbInstance.ts`: Changed `rejectUnauthorized: false` to `rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'` (configurable, defaults to true)

**P0 - Hardcoded Secrets Removed (6 files)**
- `scripts/debug/check_stuck_payment.js`: Redis URL → `process.env.REDIS_PUBLIC_URL`
- `scripts/debug/clear_stuck_txid.js`: Redis URL → `process.env.REDIS_PUBLIC_URL`
- `scripts/migration/fix_redis_for_retry.js`: Redis URL → `process.env.REDIS_PUBLIC_URL`
- `scripts/manual_sweep_usdt_trc20.ts`: Encrypted key → `process.env.USDT_TRC20_ENCRYPTED_KEY`
- `scripts/migration/migrate_john_user.js`: DB credentials → env vars
- `verify_private_key.ts`: Encrypted key → `process.env.VERIFY_ENCRYPTED_KEY`

**P1 - XSS Prevention (6 locations in walletController.ts)**
- Added `escapeHtml()` utility function
- Applied to all email template interpolations (wallet added/updated/removed emails)
- Escapes companyName, currency, wallet_address, wallet_name, wallet_type

**P1 - Package Upgrades**
- `axios`: 1.4.0 → 1.13.5
- `nodemailer`: 6.9.3 → 8.0.1  
- `multer`: 1.4.5-lts.1 → 1.4.5-lts.2 (kept v1 for API compat, fixes DoS vulnerabilities)

**Bug Fixes**
- `merchantPoolConfig.ts`: Fixed `parseSweepConfig` to check env var overrides BEFORE defaulting UTXO chains to "batch" mode
- `merchantPoolSweep.ts`: Added UTXO balance rounding to 8 decimal places to prevent Tatum API validation errors from floating point imprecision
- LTC sweep successfully executed: TX `51665a57dd5c2b9d68a8782cf61b7fa38b8cff12775ffe1f1708aae007168288`

### Previous Session: UTXO Payment Bug Fix
- Fixed balance parsing for UTXO chains (incoming - outgoing instead of balance field)
- Fixed fee format for Tatum SDK (string vs object)
- Fixed fee deduction from sweep amount

## Prioritized Backlog

### P1 - Remaining from Security Audit
- SRI attribute for external scripts in `frontend/public/index.html`
- Remaining SCA: axios sub-dependency in @tatumio and tronweb (no direct fix)

### P2 - Code Quality (from audit report)
- 1115 code smells (await in loops, missing radix, string concatenation)
- 501 lines dead code
- 7180 lines duplicate code across 173 groups
- 247 functions missing docstrings
- Accessibility issues in frontend components

### P3 - Infrastructure
- SSH tunnel auto-reconnect on container restart (currently manual)
- Redis lock TTL monitoring to prevent stale lock accumulation
- Stablecoin conversion lock hanging investigation
