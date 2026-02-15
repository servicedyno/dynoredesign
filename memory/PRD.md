# DynoPay - Product Requirements Document

## Overview
DynoPay is a full-stack cryptocurrency payment platform with a React frontend and TypeScript/Node.js backend. It handles cryptocurrency payments via the Tatum API, merchant webhook delivery, and multi-chain support.

## Core Architecture
- **Frontend**: React (port 3000)
- **Backend**: TypeScript/Node.js/Express (internal port 3300, proxied via Python/uvicorn on port 8001)
- **Database**: PostgreSQL (primary), Redis (caching, queues, payment state)
- **Payments**: Tatum API for wallet generation, transaction monitoring, webhook notifications
- **Queue**: BullMQ for persistent webhook processing

## Key Features
- Multi-chain crypto payments (BTC, ETH, XRP, RLUSD, BCH, DOGE, LTC, TRX, USDT)
- Merchant API with webhook delivery
- Payment links
- Underpayment/overpayment handling
- Admin diagnostics dashboard
- Volatility monitoring
- Error monitoring with email alerts

## Credentials
- **User**: richard@dyno.pt / Katiekendra123@
- **Company ID**: 38 (Bozzmail)

## What's Been Implemented

### Phase: Code Cleanup (Completed)
- Removed dead code (csrfProtection, unused middleware)
- Archived unused scripts to `backend/scripts/_archive/`
- Cleaned unused dependencies from package.json
- Consolidated documentation into `/app/docs/`

### Phase: Failed Payment Recovery (Completed)
- Investigated and recovered failed transaction for `richard@dyno.pt`
- Created temporary recovery endpoint (now removed)

### Phase: Robust Offline Payment Processing (Completed - Feb 15, 2026)
**P0 - BullMQ Queue System:**
- Installed BullMQ with Redis-backed persistent job queue
- Created `services/webhookQueue.ts`: Queue definition, worker management, DLQ, health monitoring
- Created `services/webhookProcessor.ts`: Core processing logic extracted from webhook handler
- Refactored `webhooks/index.ts`: tatumCryptoWebHook is now a thin enqueuer

**P0 - Startup Reconciliation:**
- Created `services/reconciliation.ts`: Three reconciliation strategies
- Runs automatically on server startup

**P0 - Hardening & Monitoring:**
- BullMQ retry policy: 3 attempts with exponential backoff
- Dead-letter queue for permanently failed jobs
- Admin diagnostic endpoints for queue health, DLQ, and reconciliation
- Graceful shutdown with BullMQ cleanup

### Phase: Unit Testing Framework (Completed - Feb 15, 2026)
- **Total: 511 tests passing across 15 suites**
- Phase 1: 168 tests (7 suites) - foundation + bug fixes
- Phase 2: 52 tests (1 suite) - webhook processor pipeline
- Phase 3: 66 tests (3 suites) - payment fees, blockchain fees, fee rates
- Phase 4: 40 tests (1 suite) - Redis cache operations, distributed locking
- Phase 5: 25 tests (1 suite) - webhook handlers, merchant webhook delivery
- Fee Service: 28 tests (1 suite) - centralized fee calculation logic
- State Machine: 132 tests (1 suite) - payment lifecycle state machine

### Payment State Machine (Completed - Feb 15, 2026)
- Created `services/paymentStateMachine.ts` - formal state machine with 11 states
- States: pending -> detected -> confirming -> confirmed -> underpaid -> processing -> converted -> payout_complete -> failed -> expired -> refunded
- Features: canTransition(), transition(), isTerminal(), parseState(), getTransitionMap()
- Backward-Compatibility Layer: toRedisStatus(), toExternalStatus(), toWebhookEvent(), validateTransition()
- 132 comprehensive unit tests

**P0 - Soft-Enforcement in webhookProcessor.ts:**
- Wired validateTransition() into all 10 status change points
- Created softValidate() helper for non-breaking audit/warning logging
- 13 softValidate() calls covering all status transitions

**P1 - Hard-Enforce State Machine Across Codebase:**
- paymentController.ts: All status comparisons use PaymentState enum
- walletController.ts: Redis writes use toRedisStatus()
- reconciliation.ts: Stuck payment detection uses parseState()

### Status Normalization (Completed - Feb 15, 2026)
- All endpoints return both `status` (legacy) and `payment_status` (normalized)
- Auto-conversion statuses normalized with `display_status`
- Bug fixed: Crash recovery webhook status corrected
- Legacy tatumWebHook uses state machine enums

### Auto-Stablecoin Conversion (Completed - Feb 15, 2026)
- Company Settings: auto_convert_enabled, settlement_currency, settlement_wallet_address, settlement_chain
- Binance Service: Full API client with HMAC-SHA256 signing, Convert API, withdrawal, deposit detection
- Conversion Service: Cron-based pipeline
- Conversion Model: tbl_stablecoin_conversion with full audit trail
- API Endpoints for auto-convert settings and conversion history

### Other Completed Work
- Centralized Fee Logic in feeService.ts
- QR Code Currency Logo Overlay (all 15 currencies)
- JSON Parse Error Fix (400 instead of 500)
- Error Alert Email System (Redis-backed, Brevo integration)
- BinanceWS Logging (winston cronLogger)
- Binance Proxy Auto-Detection
- PostgreSQL Connection Stability Fixes
- Auto-Conversion Disable Flow Enhancement
- Webhook URL Startup Migration
- Fee Tier Gap Fix (FEE_TIER_1_MIN=0)
- PayloadTooLargeError Fix (10mb limit)
- Missing Payment Email Notifications Fix
- XRP/RLUSD Destination Tag Gaps Fixed
- Security Hardening (XSS sanitization, password strength, CSP, etc.)

### SSH Proxy + Test Payments (Completed - Feb 16, 2026)
- Binance SSH proxy started (SOCKS5 tunnel to German VPS 95.179.167.16)
- $10 BTC payment created for Company 38:
  - TX: 5ca4e674-aea8-411d-bc6b-03d0f959d4d3
  - Address: bc1qh2hhcesallu4fpfkvvhus3z3tkqmrtzn8n5rc9
  - Amount: 0.00014629 BTC
- $10 ETH payment created for Company 38:
  - TX: 87bd98db-8913-4e43-a0b9-2f20a54cf7e4
  - Address: 0xdb0c01c41879d877654050002e6e6f283841c9c3
  - Amount: 0.00514798 ETH

## Key Files
- `backend/services/webhookQueue.ts` - BullMQ queue, worker, DLQ
- `backend/services/webhookProcessor.ts` - Core webhook processing logic
- `backend/services/paymentStateMachine.ts` - Payment state machine
- `backend/services/reconciliation.ts` - Startup reconciliation
- `backend/services/binanceService.ts` - Binance API client
- `backend/services/conversionService.ts` - Auto-conversion pipeline
- `backend/webhooks/index.ts` - Webhook handlers
- `backend/controller/paymentController.ts` - Payment endpoints
- `backend/server.ts` - Main server

## Backlog
- **P2: Enhanced Monitoring** - Monitoring and alerting for state machine audit logs
- **P3: Pre-existing TypeScript errors** in reconciliation.ts and webhookQueue.ts
- **P3: Dependency Injection refactoring** to decouple services for better testability
