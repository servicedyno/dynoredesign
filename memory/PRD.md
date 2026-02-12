# DynoPay - Crypto Payment Gateway PRD

## Original Problem Statement
Full-stack cryptocurrency payment gateway (DynoPay) with Node.js/TypeScript backend, React frontend, PostgreSQL + Redis databases. Integrated with Tatum (crypto ops), Binance (currency conversion), and Brevo (transactional emails). Deployed on Railway.

## Architecture
- **Backend**: Node.js/TypeScript + Express, running on Railway (port 3300)
- **Frontend**: React.js
- **Database**: PostgreSQL (Sequelize ORM) + Redis (caching/locks)
- **Emergent Pod**: Python/uvicorn proxy on 8001 -> Node.js on 3300
- **3rd Party**: Tatum, Binance, Brevo (Sendinblue), Blockstream, Blocknative
- **Production URL**: https://api.dynopay.com

## What's Been Implemented

### Session 1
- Full codebase analysis and security audit
- Security improvements: envValidator, destinationTagValidator, circuitBreaker, webhookRetry, securityLogger
- Railway deployment troubleshooting
- Binance diagnostic endpoints

### Session 2 (Feb 12, 2026)
- Fixed broken email logo (SVG -> hosted PNG)
- Fixed Binance Convert API -> Spot Market Orders
- Added exchange info, spot quote diagnostic endpoints

### Session 3 (Feb 12, 2026) - Adaptive Conversion System
- Volatility Monitor (volatilityMonitorService.ts): 10 crypto assets, ROC-based classification
- Fee Rate Service (feeRateService.ts): Live BTC/ETH fees, Redis-cached
- Limit IOC Sell Logic in binanceService.ts
- New Payout Logic in conversionService.ts (merchant absorbs drops)
- Extended stablecoinConversions model
- Cron Integration + Diagnostic Endpoints

### Session 4 (Feb 12, 2026) - Live Testing & Verification
- POL Sale Verified: 77.30 POL -> 7.258 USDT (Order #1001683800, FILLED)
- Volatility Monitor, Fee Rate Service, Spot Quotes all verified on Railway

### Session 5 (Feb 12, 2026) - Auto-Conversion Payout Email
- **New email template**: `sendAutoConversionPayoutEmail` in `helper/sendEmail.ts`
  - Shows crypto received + stablecoin payout side-by-side
  - Compares conversion price vs current live price (savings calculation)
  - Conditional design: visual volatility bar + savings block when VOLATILE/DECLINING, text-focused when STABLE
  - Full conversion details table (rate, market state, date, TX hash, conversion ID)
- **Integration**: Email auto-sent when withdrawal completes in `conversionService.ts` `monitorWithdrawals()`
  - Fetches merchant user/company info from DB
  - Gets current live price from Binance for savings calculation
- **Preview endpoint**: `GET /api/diagnostics/conversion-email-preview?volatile=true|false`
- Files changed: `helper/sendEmail.ts`, `services/conversionService.ts`, `routes/diagnosticsRouter.ts`

## Prioritized Backlog

### P0 - Completed
- [x] Fix broken email logo
- [x] Fix Binance Convert API -> Spot Trading
- [x] Implement Adaptive Conversion System
- [x] Test POL sale on live Binance
- [x] Test Volatility Monitor & Fee Rate Service
- [x] Auto-conversion payout email with conditional design

### P1 - Next
- [ ] Deploy new email code to Railway and test with real conversion
- [ ] End-to-end test of full conversion pipeline (trigger-conversion with admin auth)

### P2 - Future
- [ ] Refactor large controller files (see /app/CONTROLLER_REFACTORING_PLAN.md)
- [ ] Migrate email logo to permanent CDN (S3/CloudFront)

## Key Diagnostic Endpoints (Production)
- `POST /api/diagnostics/binance-sell` - Sell crypto asset
- `GET /api/diagnostics/binance-balances` - Non-zero Binance balances
- `GET /api/diagnostics/binance-quote` - Spot quote
- `GET /diagnostics/volatility` - Market states
- `POST /diagnostics/volatility-refresh` - Force refresh
- `GET /diagnostics/fee-rates?chain=BTC` - Live blockchain fees
- `GET /api/diagnostics/conversion-email-preview?volatile=true` - Email preview
- `POST /diagnostics/trigger-conversion` - Manual conversion (admin auth)

## Key Files
- `backend/helper/sendEmail.ts` - All email templates including auto-conversion payout
- `backend/services/conversionService.ts` - Conversion pipeline + email trigger
- `backend/services/volatilityMonitorService.ts` - Market state detection
- `backend/services/feeRateService.ts` - Live blockchain fee fetching
- `backend/services/binanceService.ts` - Spot trading + Limit IOC
- `backend/routes/diagnosticsRouter.ts` - Test/preview endpoints
- `backend/server.ts` - Cron jobs + route registration

### Session 10 (Feb 12, 2026) - Auto-Conversion Wallet Selection Flow
- **Improved `updateAutoConvertSettings`** in `backend/controller/companyController.ts`:
  - Two-step enable flow: Step 1 returns eligible stablecoin wallets with last 4 digits for selection; Step 2 enables with chosen wallet
  - Returns 400 error with clear message when no eligible stablecoin wallets exist
  - Invalid selection returns available options in error message
- **Improved `getAutoConvertSettings`**: Now includes `wallet_address_preview` (masked last 4 digits) in available settlement options
- **Extracted `getEligibleStablecoinWallets` helper** for reuse across GET and PUT endpoints

## Pending/Backlog
- P1: End-to-end auto-conversion test on Railway (blocked on deployment)

### Session 10b (Feb 12, 2026) - Brevo Fix + Error Logging Consolidation
- **Brevo ERR_BAD_REQUEST fix** in `backend/utils/mailTransporter.ts`:
  - Added input validation (email format, empty subject/body) before hitting Brevo API
  - Added 15s timeout to prevent hung requests
  - Capped `textContent` at 50K chars to prevent oversized payloads
  - Wrapped Brevo API call in try/catch with `captureError` including payload size for diagnostics
- **Consolidated error logging** across the codebase:
  - `captureError` now logs a structured one-liner (`[ErrorMonitor] [COMPONENT] message | code | status | ctx`) at warn/error level
  - Removed all 15 duplicate `console.log(...formatEmailError(e))` lines from `sendEmail.ts`
  - Removed 2 duplicate `console.error` lines from `cronJobs.ts`
  - Deleted unused `formatEmailError` helper function
  - All error paths now go through a single `captureError` → log + buffer + optional alert pipeline

- P3: Refactor error handling consolidation further if needed

