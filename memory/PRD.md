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
- Refactored `webhooks/index.ts`: tatumCryptoWebHook is now a thin enqueuer (validates → enqueues → returns 200 immediately)

**P0 - Startup Reconciliation:**
- Created `services/reconciliation.ts`: Three reconciliation strategies
  1. Redis scan for stuck "processing"/"retrying" payments
  2. Redis scan for `failed-payment-*` keys
  3. Tatum API query for failed webhook deliveries
- Runs automatically on server startup

**P0 - Hardening & Monitoring:**
- BullMQ retry policy: 3 attempts with exponential backoff (5s, 30s, 120s)
- Dead-letter queue for permanently failed jobs
- Admin diagnostic endpoints:
  - `GET /diagnostics/webhook-queue` — queue health stats
  - `GET /diagnostics/webhook-queue/dlq` — list DLQ items
  - `POST /diagnostics/webhook-queue/dlq/:jobId/retry` — retry DLQ item
  - `POST /diagnostics/webhook-queue/reconcile` — manual reconciliation trigger
- Graceful shutdown with BullMQ cleanup
- Worker concurrency: 5, rate-limited to 10 jobs/sec
- Error monitoring integration (admin email alerts)

**P1 - Cleanup:**
- Removed temporary `/diagnostics/recover-payment` endpoint from server.ts

### Phase: Unit Testing Framework (Completed - Feb 15, 2026)
**Phase 1 — Foundation (7 test suites, 168 tests):**
- Integrated Jest for backend unit testing (`jest.config.ts`)
- Created `__tests__/__mocks__/` for DB/Redis/model isolation
- Test suites: adminWalletMapping, confirmationRequirements, cryptoClassification, feeCalculation, feeConfigUtils, merchantPoolConfig, settlementMath
- Fixed bugs discovered via tests:
  - `calculateFee.ts`: Missing BTC fee rates returned 0 instead of error
  - `calculateUnderpayment.ts`: Precision issue misclassifying underpayments (Big.js fix)

**Phase 2 — Webhook Processor Tests (1 test suite, 52 tests):**
- Comprehensive test coverage for `webhookProcessor.ts` — the most critical business logic
- 12 test categories covering the full pipeline:
  1. Duplicate detection (processed-tx key)
  2. Atomic lock acquisition/release
  3. Internal wallet filter (admin/fee wallets)
  4. Address resolution (BCH normalization, XRP destination tags, fallbacks)
  5. Amount validation (zero, negative, NaN)
  6. Status checks (already-successful payments)
  7. Crash recovery for stale "processing" payments
  8. New transaction handling + completion payments
  9. Underpayment logic (payment link wait vs direct API immediate)
  10. Minor underpayment threshold acceptance
  11. CryptoVerification with retries + non-retryable error handling
  12. Query param enrichment + full pipeline integration test

### Testing Summary
- **Total: 220 tests passing across 8 suites**
- All previous tests (iteration_4.json) + new webhook processor tests verified

## Credentials
- **User**: richard@dyno.pt / Katiekendra123@

## Key Files
- `backend/services/webhookQueue.ts` — BullMQ queue, worker, DLQ
- `backend/services/webhookProcessor.ts` — Core webhook processing logic
- `backend/services/reconciliation.ts` — Startup reconciliation
- `backend/webhooks/index.ts` — Webhook handlers (thin enqueuer)
- `backend/server.ts` — Main server, startup, endpoints, shutdown
- `backend/utils/redisInstance.ts` — Redis connection
- `backend/utils/webhookRetry.ts` — Merchant webhook retry

### Phase: Reconciliation Log Cleanup (Completed - Feb 15, 2026)
- Fixed noisy `reconcileTatumFailedWebhooks()` function that re-queued all 50+ historical webhooks on every startup
- Added 7-day time-based filter to skip stale webhooks
- Changed API sort from `asc` to `desc` (newest first)
- Added clean summary log: `"Tatum webhooks: X re-queued, Y skipped (older than 7d), Z skipped (already processed)"`
- File: `backend/services/reconciliation.ts`

## Architecture Diagrams
- System Overview: https://static.prod-images.emergentagent.com/jobs/c586ec27-53a2-4d4a-9555-00021f104f43/images/d2853814b1b29d5c949b16233f069d686592f1f0b8ce440f337e11b8b0faf736.png
- Webhook Processing Pipeline: https://static.prod-images.emergentagent.com/jobs/c586ec27-53a2-4d4a-9555-00021f104f43/images/369d9e1997696cde84ad4f7850fe1b685432f287899a2057b15388770cca4043.png
- Data Architecture: https://static.prod-images.emergentagent.com/jobs/c586ec27-53a2-4d4a-9555-00021f104f43/images/ea99c4f101c12bdd9cb07f3607b6399da07e4f5d8f576eb3b2862a52094ea2c1.png

## Backlog
- **P1: Phase 3 — Core Payment & Fee Service Testing**: Unit tests for `payment.service.ts` and `fee.service.ts` (payment state management, fee application)
- **P2: Phase 4 — Redis Service & Data Consistency Testing**: Tests for Redis atomicity, race conditions, locking mechanisms
- **P2: Phase 5 — API Endpoint Integration Testing**: Full request-response cycle tests for `/get-data`, `/webhook/tatum`
- **P3: Dependency Injection refactoring** to decouple services from Sequelize models for better testability
- P1: DLQ email alerting (notify admin when jobs land in dead-letter queue)
