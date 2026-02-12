# DynoPay - Crypto Payment Gateway PRD

## Original Problem Statement
Full-stack cryptocurrency payment gateway (DynoPay) with Node.js/TypeScript backend, React frontend, PostgreSQL + Redis databases. Integrated with Tatum (crypto ops), Binance (currency conversion), and Brevo (transactional emails). Deployed on Railway.

## Architecture
- **Backend**: Node.js/TypeScript + Express, running on Railway (port 3300)
- **Frontend**: React.js
- **Database**: PostgreSQL (Sequelize ORM) + Redis (caching/locks)
- **Emergent Pod**: Python/uvicorn proxy on 8001 → Node.js on 3300
- **3rd Party**: Tatum, Binance, Brevo (Sendinblue)

## What's Been Implemented

### Session 1 (Previous)
- Full codebase analysis and security audit
- Removed private key logging
- Implemented: envValidator, destinationTagValidator, circuitBreaker, webhookRetry, securityLogger, transactionHelper, redisKeyNamespace
- CSRF protection and enhanced health check
- Railway deployment troubleshooting (envValidator fix)
- Binance diagnostic endpoints
- Email system verification via Brevo

### Session 2 (Current - Feb 12, 2026)
- **Fixed broken email logo (P0)**: Changed from inaccessible GitHub SVG to publicly hosted PNG at `https://files.catbox.moe/9wq2et.png`. Verified rendering via `/api/diagnostics/email-preview`.
- **Updated CSP**: Added `files.catbox.moe` and `cdn-icons-png.flaticon.com` to imgSrc whitelist.
- **Added email preview endpoint**: `GET /api/diagnostics/email-preview` for logo rendering verification.
- **Made diagnostics accessible**: Mounted diagnostics router at both `/diagnostics` and `/api/diagnostics`.
- **Fixed Binance Convert API (P1)**: The Convert API (`/sapi/v1/convert/`) requires special pre-approval from Binance's developer portal — not available with standard API keys. Switched to **Spot Market Orders** (`/api/v3/order`) which works with the existing `canTrade: true` permission.
  - Added `getExchangeInfo()`, `placeMarketSellOrder()`, `convertViaSpotTrade()`, `getSpotQuote()` to `binanceService.ts`
  - Updated `conversionService.ts` to use spot trading instead of Convert API
  - Updated diagnostics to test spot trading
  - Added `binance-exchange-info` diagnostic endpoint

## Prioritized Backlog

### P0 - Completed
- [x] Fix broken email logo in production
- [x] Fix Binance Convert API → switched to Spot Trading

### P1 - Needs Railway Deployment
- [ ] **Deploy to Railway**: Both the email logo fix and Binance spot trading changes need to be deployed
- [ ] **Verify email logo in production**: Trigger an email after deployment
- [ ] **Verify Binance spot trading**: Test `/diagnostics/binance-quote` and `/diagnostics/binance-exchange-info` after deployment

### P2 - Future
- [ ] **Refactor large controller files** (see `/app/CONTROLLER_REFACTORING_PLAN.md`)
- [ ] **Migrate logo to permanent CDN**: catbox.moe is free hosting; consider S3/CloudFront for long-term

## Key Files Changed This Session
- `backend/helper/sendEmail.ts` - Updated logo URL to public PNG CDN
- `backend/server.ts` - Updated CSP imgSrc, added `/api/diagnostics` mount
- `backend/services/binanceService.ts` - Added Spot Trading functions
- `backend/services/conversionService.ts` - Switched from Convert API to Spot Trading
- `backend/routes/diagnosticsRouter.ts` - Added email-preview, exchange-info, updated quote to spot

## Testing Notes
- Emergent pod is geo-restricted from Binance (US region) — authenticated and some public calls fail
- Railway deployment is NOT geo-restricted — all Binance endpoints work
- Email preview screenshot verified: logo renders correctly in header and footer
- TypeScript compiles with zero errors (`tsc --noEmit --skipLibCheck` passes)
