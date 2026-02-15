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

### Session Feb 15, 2026: Unused Exports + Controller Deduplication

**Task 1 — Unused Export Cleanup**
- Deep-verified 108 candidates → 11 confirmed truly unused
- Removed: `getAllSupportedCurrencies`, `getAllStrategies` (chains), `initVeriffService`, `BinanceCircuitBreaker`, `EmailCircuitBreaker`, `corsOptions`, `logInfo/logWarn/logDebug/logError` (loggers), `getFallbackDiagnostics`, `resetFallbackMetrics`

**Task 2 — Controller Duplication Reduction**
- Created `helper/controllerErrorHandler.ts` with `handleControllerError` and `handleControllerErrorReturn`
- Replaced 134 catch blocks across 12 controllers with shared error handler:
  - walletController (22), userController (23), apiController (15), adminController (14), companyController (14), paymentController (8), statusController (9), notificationController (7), dashboardController (7), invoiceController (5), taxController (5), subscriptionController (5)
- Extracted `buildTransactionFilters()` helper in walletController (eliminates 27-line duplication between getWalletTransactions and exportTransactions)
- Fixed 4 TypeScript type errors found during testing

**Testing**: 23/23 tests passed (100% backend), TypeScript compilation clean

### Session Feb 15, 2026 (earlier): P1/P2 Security & Code Quality

**P1 - Subresource Integrity (SRI)**
- Added `integrity` + `crossorigin` to external script in `frontend/public/index.html`

**P1 - Sub-dependency Vulnerability Fixes**
- `npm audit fix`: Fixed `node-forge` and `qs`
- Remaining 4 high-severity unfixable in @tatumio, flutterwave, tronweb (upstream)

**P2 - Structured Logging Migration (1371 replacements)**
- Replaced all console.log/error/warn with Winston loggers across 54+ files
- Remaining 65 in standalone scripts/model inits (acceptable)

### Session Feb 14-15, 2026: Security Audit Fixes
- SQL Injection fixes (6 locations, parameterized queries)
- TLS verification fix (configurable rejectUnauthorized)
- Hardcoded secrets removed (6 files → env vars)
- XSS prevention (6 locations, escapeHtml utility)
- Package upgrades (axios, nodemailer, multer)

### Previous: UTXO Payment Bug Fix + LTC Sweep Fix

## Prioritized Backlog

### P2 - Remaining Code Quality
- 65 console.log in standalone scripts/model inits (low priority)
- Email service duplication: `helper/sendEmail.ts` (1231 lines) and `services/emailService.ts` (1450 lines) overlap
- Remaining ~46 getErrorMessage(e) calls with custom logic (non-standard patterns)

### P2 - Code Duplication Hotspots (reduced from original)
- walletController.ts: wallet increment pattern (5x), query column aliasing
- paymentController.ts: subscription cleanup (8x), threshold KYC check (4x)
- Cross-file email template duplication

### P3 - Infrastructure
- SSH tunnel auto-reconnect (keepalive running but not supervisor-managed)
- Sub-dependency axios vulnerability tracking (@tatumio, tronweb, flutterwave)
- Monitor LTC conversion #16 completion
