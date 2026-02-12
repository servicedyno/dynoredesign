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
- Removed private key logging
- Implemented: envValidator, destinationTagValidator, circuitBreaker, webhookRetry, securityLogger, transactionHelper, redisKeyNamespace
- CSRF protection and enhanced health check
- Railway deployment troubleshooting
- Binance diagnostic endpoints
- Email system verification via Brevo

### Session 2 (Feb 12, 2026)
- Fixed broken email logo (SVG -> hosted PNG)
- Updated CSP for image sources
- Added email preview endpoint
- Fixed Binance Convert API -> Spot Market Orders
- Added exchange info, spot quote diagnostic endpoints

### Session 3 (Feb 12, 2026) - Adaptive Conversion System
- **Volatility Monitor** (`volatilityMonitorService.ts`): Tracks 10 crypto assets via Binance klines, calculates ROC (Rate of Change), classifies market states (STABLE/VOLATILE/DECLINING), assigns fee tiers
- **Fee Rate Service** (`feeRateService.ts`): Fetches live BTC fees (Blockstream), ETH gas (Blocknative), static fees for other chains. Redis-cached with 60s TTL
- **Limit IOC Sell Logic** (`binanceService.ts`): placeLimitIOCSellOrder for price-controlled selling on Binance Spot
- **New Payout Logic** (`conversionService.ts`): Merchant absorbs price drops model with adaptive sweep fees
- **Database Schema**: Extended stablecoinConversions model with: locked_merchant_usd, locked_exchange_rate, actual_sale_usd, platform_surplus, price_movement_pct, fee_tier_used, market_state_at_sweep
- **Cron Integration**: Volatility monitor runs on 60s cycle in server.ts
- **Diagnostic Endpoints**: binance-sell, volatility, volatility-refresh, fee-rates

### Session 4 (Feb 12, 2026) - Live Testing & Verification
- **POL Sale Verified**: Sold 77.30 POL -> 7.258 USDT @ 0.0939/POL (Order ID: 1001683800, FILLED)
- **Volatility Monitor Verified**: All 10 assets returning live market states correctly
- **Fee Rate Service Verified**: BTC (Blockstream) and ETH (Blocknative) live fee fetching confirmed
- **Spot Quote Verified**: BTC and ETH price quotes working
- **Exchange Info Verified**: Lot sizes and min quantities returning correctly

## Prioritized Backlog

### P0 - Completed
- [x] Fix broken email logo in production
- [x] Fix Binance Convert API -> Spot Trading
- [x] Implement Adaptive Conversion System (all phases)
- [x] Test POL sale on live Binance (FILLED)
- [x] Test Volatility Monitor on Railway (WORKING)
- [x] Test Fee Rate Service on Railway (WORKING)

### P1 - Next
- [ ] End-to-end test of full conversion pipeline (trigger-conversion needs admin auth)
- [ ] Verify email logo rendering in production email delivery

### P2 - Future
- [ ] Refactor large controller files (see /app/CONTROLLER_REFACTORING_PLAN.md)
- [ ] Migrate logo to permanent CDN (catbox.moe -> S3/CloudFront)

## Key Diagnostic Endpoints (Production)
- `POST /api/diagnostics/binance-sell` - Sell crypto asset (body: {asset, amount})
- `GET /api/diagnostics/binance-balances` - Non-zero Binance balances
- `GET /api/diagnostics/binance-quote?from=BTC&to=USDT&amount=0.001` - Spot quote
- `GET /api/diagnostics/binance-exchange-info?symbol=POLUSDT` - Trading pair info
- `GET /diagnostics/volatility` - Market states for all monitored assets
- `POST /diagnostics/volatility-refresh` - Force refresh market data
- `GET /diagnostics/fee-rates?chain=BTC` - Live blockchain fees
- `POST /diagnostics/trigger-conversion` - Manual conversion cycle (admin auth required)
- `GET /diagnostics/conversion-stats` - Conversion statistics (admin auth required)

## Key Files
- `backend/apis/binanceService.ts` - Spot trading + Limit IOC logic
- `backend/services/conversionService.ts` - Payout model + adaptive fees
- `backend/services/volatilityMonitorService.ts` - Market state detection
- `backend/services/feeRateService.ts` - Live blockchain fee fetching
- `backend/routes/diagnosticsRouter.ts` - Test endpoints
- `backend/server.ts` - Cron jobs + route registration
