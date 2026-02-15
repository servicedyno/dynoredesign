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

### Session Feb 15, 2026: Logging Cleanup + SSH Tunnel Auto-Reconnect

**Task 3 — Final console.log Replacement (utils, services, helpers, controllers)**
- Replaced all remaining active `console.log/error/warn` calls in application source:
  - `utils/envValidator.ts` (11 calls → logger)
  - `utils/mailTransporter.ts` (1 call → logger)
  - `utils/currencyUtils.ts` (1 call → logger)
  - `utils/dbInstance.ts` (Sequelize logging config → logger wrapper)
  - `helper/passwordHelper.ts` (2 calls → logger)
  - `controller/index.ts` (2 calls → logger)
- Zero active `console.log` calls remain outside `loggers.ts` (the logger itself), migration scripts, and Swagger code examples
- TypeScript compilation: zero errors

**Task 4 — SSH Tunnel Auto-Reconnect**
- Created `services/sshTunnelManager.ts`: Node.js-managed SSH SOCKS5 tunnel lifecycle
  - Auto-starts on boot (when SSH_TUNNEL_HOST configured)
  - Periodic TCP health probes every 30s
  - Auto-reconnect with exponential backoff (30s → 60s → 120s → cap 300s)
  - Early `sshpass` availability check (prevents useless retry loops)
  - Re-triggers `detectBinanceAccess()` when tunnel is restored
  - Graceful SIGTERM/SIGINT shutdown
  - Kills stale tunnel processes on startup
- Added `GET /diagnostics/tunnel-status` endpoint for health monitoring
- Moved SSH credentials from hardcoded bash script to `.env` variables:
  - `SSH_TUNNEL_HOST`, `SSH_TUNNEL_USER`, `SSH_TUNNEL_PASS`, `SSH_TUNNEL_LOCAL_PORT`
- Updated `scripts/ssh-tunnel-keepalive.sh` to read from env vars (fallback/reference)
- Wired tunnel start into `server.ts` before Binance access detection

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

### Session Feb 2026: Email Service Merge
- Merged `helper/sendEmail.ts` (1232 lines) + `services/emailService.ts` (1451 lines) into single unified `services/emailService.ts` (2382 lines)
- `helper/sendEmail.ts` reduced to 25-line re-export shim for backwards compatibility
- Eliminated 3 duplicate functions: sendPaymentReceivedEmail, sendWeeklySummaryEmail, sendSecurityAlertEmail
- Eliminated duplicate dynoPayEmailTemplate; exported `dynoPayGreetingTemplate` for greeting-style emails
- Converted several payment functions to use shared template components (infoBox, dataRow, statusBadge)
- Net reduction: 276 lines, single source of truth for all 35+ email functions
- TypeScript compilation: zero errors

## Prioritized Backlog

### P1 - Pending Issues
- UTXO auto-convert sweep notification: user verification pending (trigger $10 LTC payment to test)
- Merchant email deliverability: check Brevo sender domain verification + delivery logs for `richard@dyno.pt`

### P2 - Remaining Code Quality
- 65 console.log in standalone scripts/model inits (low priority — migration scripts, not runtime)
- Remaining ~46 getErrorMessage(e) calls with custom logic (non-standard patterns)

### P2 - Code Duplication Hotspots (reduced from original)
- walletController.ts: wallet increment pattern (5x), query column aliasing
- paymentController.ts: (subscription cleanup & KYC checks already extracted to helpers in prior session)

### P3 - Infrastructure
- SSH tunnel auto-reconnect: DONE — managed by `sshTunnelManager.ts`
- Sub-dependency axios vulnerability tracking (@tatumio, tronweb, flutterwave)
- Monitor LTC conversion #16 completion
