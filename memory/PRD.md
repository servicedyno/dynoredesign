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
- **Fixed broken email logo (P0)**: Changed from inaccessible GitHub SVG to publicly hosted PNG at `https://files.catbox.moe/9wq2et.png`
- **Updated CSP**: Added `files.catbox.moe` and `cdn-icons-png.flaticon.com` to imgSrc whitelist
- **Added email preview endpoint**: `GET /api/diagnostics/email-preview` for logo rendering verification
- **Made diagnostics accessible**: Mounted diagnostics router at both `/diagnostics` and `/api/diagnostics`

## Prioritized Backlog

### P0 - Completed
- [x] Fix broken email logo in production

### P1 - Pending
- [ ] **Binance API authentication**: User updated permissions. Needs testing from Railway (Emergent pod in Binance-restricted region). Test via `/diagnostics/binance-account` and `/diagnostics/binance-quote`

### P2 - Upcoming
- [ ] **Refactor large controller files** (see `/app/CONTROLLER_REFACTORING_PLAN.md`): Split `paymentController.ts`, `adminController.ts`, `invoiceController.ts`

## Key Files
- `backend/helper/sendEmail.ts` - Email templates with logo URL
- `backend/server.ts` - Main server entry point
- `backend/routes/diagnosticsRouter.ts` - Diagnostic/testing endpoints
- `backend/services/binanceService.ts` - Binance integration
- `backend/utils/envValidator.ts` - Environment validation

## Known Issues
- Binance authenticated API calls fail from Emergent pod (geographic restriction). Must test from Railway deployment.
- `catbox.moe` is a free hosting service - for long-term production use, consider migrating logo to a proper CDN or S3 bucket.
