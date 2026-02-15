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

### Session Feb 15, 2026: P1/P2 Security & Code Quality

**P1 - Subresource Integrity (SRI)**
- Added `integrity="sha384-..."` and `crossorigin="anonymous"` to external script in `frontend/public/index.html`

**P1 - Sub-dependency Vulnerability Fixes**
- Ran `npm audit fix`: Fixed `node-forge` (in flutterwave-node-v3) and `qs` vulnerabilities
- Remaining 4 high-severity are unfixable sub-dependencies in `@tatumio/api-client`, `flutterwave-node-v3`, `tronweb` (axios <=1.13.4)

**P2 - Structured Logging Migration (1371 replacements)**
- Replaced all `console.log/error/warn` calls with proper Winston logger calls across:
  - 15 controller files (504 replacements)
  - 21 service/helper/util files (333 replacements)  
  - 9 additional service/route files (453 replacements)
  - 9 remaining production files (81 replacements)
- Logger mapping: cronLogger (cron/blockchain ops), apiLogger (API/general), walletLogger, webhookLogs, etc.
- Fixed broken import patterns in tatumApi.ts, merchantPoolSweep.ts caused by script injection
- Added missing imports in circuitBreaker.ts, merchantPoolValidator.ts
- Remaining 65 console.log in standalone scripts, model inits, middleware setup (acceptable)

**Infrastructure**
- Restarted Binance SOCKS5 proxy SSH tunnel (port 1080)
- Started SSH tunnel keepalive script in background

### Session Feb 14-15, 2026: Security Audit Fixes

**P0 - SQL Injection Fixes (6 locations)**
- `walletController.ts` lines 301, 511, 4057, 4203: Parameterized queries
- `companyController.ts` line 662: Parameterized
- `adminController.ts` line 644: Parameterized + whitelisted ORDER BY

**P0 - TLS Verification Fix**
- `dbInstance.ts`: Configurable `rejectUnauthorized` via `DB_SSL_REJECT_UNAUTHORIZED`

**P0 - Hardcoded Secrets Removed (6 files)**
- Redis URLs, encrypted keys, DB credentials → env vars

**P1 - XSS Prevention (6 locations in walletController.ts)**
- Added `escapeHtml()` utility, applied to email template interpolations

**P1 - Package Upgrades**
- `axios`: 1.4.0 → 1.13.5, `nodemailer`: 6.9.3 → 8.0.1, `multer`: security fix

**Bug Fixes**
- `merchantPoolConfig.ts`: Fixed sweep config env var precedence
- `merchantPoolSweep.ts`: UTXO balance rounding to 8 decimal places
- LTC sweep TX: `51665a57dd5c2b9d68a8782cf61b7fa38b8cff12775ffe1f1708aae007168288`

### Previous Session: UTXO Payment Bug Fix
- Fixed balance parsing for UTXO chains
- Fixed fee format for Tatum SDK
- Fixed fee deduction from sweep amount

## Prioritized Backlog

### P2 - Remaining Code Quality
- 65 console.log in standalone scripts/model inits (low priority)
- Email service duplication: `helper/sendEmail.ts` (1231 lines) and `services/emailService.ts` (1450 lines) overlap
- Error handling pattern duplication across controllers (try/catch boilerplate)
- 108 potentially unused exports identified across codebase
- Remaining code smells, dead code (reduced from original 1115/501)

### P2 - Code Duplication Hotspots
- `walletController.ts`: 256 duplicated blocks
- `paymentController.ts`: 214 duplicated blocks  
- `helper/sendEmail.ts`: 83 duplicated blocks
- `routes/diagnosticsRouter.ts`: 73 duplicated blocks

### P3 - Infrastructure
- SSH tunnel auto-reconnect on container restart (keepalive script running but not supervisor-managed)
- Redis lock TTL monitoring
- Sub-dependency axios vulnerability in @tatumio, tronweb, flutterwave (requires upstream fixes)
