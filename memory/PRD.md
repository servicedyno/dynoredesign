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
- **Total: 511 tests passing across 15 suites**
- Phase 1: 168 tests (7 suites) — foundation + bug fixes
- Phase 2: 52 tests (1 suite) — webhook processor pipeline
- Phase 3: 66 tests (3 suites) — payment fees, blockchain fees, fee rates
- Phase 4: 40 tests (1 suite) — Redis cache operations, distributed locking, stale cleanup
- Phase 5: 25 tests (1 suite) — webhook handlers, merchant webhook delivery, HMAC verification
- Fee Service: 28 tests (1 suite) — centralized fee calculation logic
- State Machine: 132 tests (1 suite) — payment lifecycle state machine + backward-compatibility layer

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

**Phase 3 — Core Payment & Fee Service Tests (3 test suites, 66 tests):**
- `paymentFees.test.ts` (23 tests): calculateTransactionFees, calculateTransactionFeesWithDiscount, getTransactionFee, getDiscountedTransactionFee, getBlockchainFee, getBlockchainConfig — tests real service layer with mocked DB/Redis
- `blockchainFeeService.test.ts` (25 tests): getBlockchainNetworkFee (UTXO/EVM/TRON/account-based chain routing, cache hits/misses, fee math), calculateCustomerPaymentAmount
- `feeRateService.test.ts` (18 tests): getFeeRates (API fallbacks, caching), estimateSweepCostUSD (BTC/ETH/LTC/default sweep cost estimation)

**Phase 4 — Redis Service & Data Consistency Tests (1 test suite, 40 tests) — Completed Feb 15, 2026:**
- `redisInstance.test.ts` (40 tests): Tests the REAL redisInstance module with mocked Redis client
  - Cache operations: setRedisItem (JSON storage, hash cleanup), setRedisItemWithTTL, setRedisTTL, getRedisItem (JSON-first with hash fallback, parse error recovery), deleteRedisItem, softDeleteRedisItem
  - Distributed locking: acquireLock (NX+TTL, retries, PID in lock value, auto-renewal with heartbeat timer), releaseLock (Lua atomic compare-and-delete, stolen lock detection, fallback del, timer cleanup)
  - withLock: success/failure/throw paths, default/custom TTL
  - cleanupStaleLocks: dead PID detection, alive PID preservation, Redis error handling
  - Jest config updated to `projects` architecture: 'unit' project (mocked Redis) + 'redis' project (real module)

**Phase 5 — Webhook Handler Integration Tests (1 test suite, 25 tests) — Completed Feb 15, 2026:**
- `webhookHandlers.test.ts` (25 tests): Tests the webhook Express handler functions
  - tatumCryptoWebHook (6 tests): enqueue flow, missing txId skip, duplicate detection, query param passing, error resilience (always 200), timestamp metadata
  - tatumWebHook (5 tests): Redis state update, counterAddress fallback, no-match handling, duplicate txId skip, zero-amount edge case
  - flutterwaveWebHook (3 tests): secret hash verification (missing/wrong/correct)
  - verifyWebhookSignature (3 tests): valid/tampered/wrong-secret HMAC-SHA256 verification
  - callMerchantWebhook (8 tests): URL resolution from customerData, skip when unconfigured, localhost rejection, HMAC signature inclusion/exclusion, 4xx no-retry, fiat enrichment

## Backlog
- **P2: Enhanced Monitoring** — Add monitoring and alerting for key payment/payout stages
- **P3: Dependency Injection refactoring** to decouple services from Sequelize models for better testability

### Status Normalization (Completed - Feb 15, 2026)

**Additive `payment_status` field across all merchant-facing endpoints (non-breaking):**

All endpoints now return both `status` (legacy, backward-compatible) and `payment_status` (normalized):

| Endpoint | `status` (kept) | `payment_status` (new) |
|----------|----------------|----------------------|
| verifyCryptoPayment | "confirmed" | "confirmed" |
| getTransactions | "successful" | "confirmed" |
| getSingleTransaction | "successful" | "confirmed" |
| Webhook (payment.confirmed) | "successful" | "confirmed" |
| Webhook (payment.pending) | "pending" | "pending" |
| Webhook (payment.underpaid) | "underpaid" | "underpaid" |

Auto-conversion statuses also normalized with `display_status`:
- PENDING_DEPOSIT → "pending", CONVERTING → "converting", COMPLETED → "settled", FAILED → "failed"

**Bug fixed:** Crash recovery webhook was sending `status: "processing"` with `event: "payment.confirmed"` — now correctly sends `"successful"`.

**Legacy cleanup:** `tatumWebHook` handler now uses `toRedisStatus(PaymentState.XXX)` instead of magic strings.

**P0 — Soft-Enforcement in webhookProcessor.ts:**
- Wired `validateTransition()` into all 10 status change points in the webhook processor
- Created `softValidate()` helper — wraps `validateTransition()` for non-breaking audit/warning logging
- 13 `softValidate()` calls covering: crash-recovery (2), underpayment (2), crypto-verification (5), ref updates (1), retries (1), failures (1), pre-processing (1)
- Replaced magic-string terminal state checks with `parseState()` + `PaymentState.PAYOUT_COMPLETE`
- Replaced stale processing detection with `parseState()` + `PaymentState.PROCESSING`
- Key gaps logged: PENDING → PROCESSING (skips DETECTED), processing → retrying (self-transition)

**P1 — Hard-Enforce State Machine Across Codebase:**
- `paymentController.ts`: 
  - Verify endpoint: All 6 status comparisons now use `parsedState === PaymentState.XXX` (catches legacy aliases automatically)
  - Redis writes: `"pending"` → `toRedisStatus(PaymentState.PENDING)`, `"successful"` → `toRedisStatus(PaymentState.PAYOUT_COMPLETE)`
  - Link status: `parseState(linkData.status) === PaymentState.PAYOUT_COMPLETE` (catches both "completed" and "successful")
- `walletController.ts`: Redis "pending" write → `toRedisStatus(PaymentState.PENDING)`
- `reconciliation.ts`: Stuck payment detection uses `parseState()` + `PaymentState.PROCESSING` (catches "processing" + "retrying")
- DB writes intentionally left as magic strings (different domain)
- Legacy aliases ("recovered", "retrying") kept for diagnostic value — `parseState()` maps them correctly
- All 511 tests passing across 15 suites (0 regressions)

### DLQ Email Alerting (Verified Existing - Feb 15, 2026)
- Confirmed DLQ email alerting was **already implemented** in `services/webhookQueue.ts` (lines 244-302)
- `sendDLQAlert()` sends a detailed HTML email to `ADMIN_EMAIL` when a job exhausts retries
- Email includes: transaction ID, address, amount, error message, retry instructions via API

### Payment State Machine (Completed - Feb 15, 2026)
- Created `services/paymentStateMachine.ts` — formal state machine with 11 states and validated transitions
- States: `pending → detected → confirming → confirmed → underpaid → processing → converted → payout_complete → failed → expired → refunded`
- Features: `canTransition()`, `transition()` (returns audit record), `isTerminal()`, `parseState()` (with legacy alias mapping), `getTransitionMap()`
- `InvalidTransitionError` class with from/to/paymentId for debugging
- Legacy status mapping: `successful/completed/recovered/done` → `payout_complete`, `retrying` → `processing`, etc.
- **Backward-Compatibility Layer** (zero breaking changes for merchants):
  - `toRedisStatus()` — maps formal state → legacy Redis string (e.g., `PAYOUT_COMPLETE` → `"successful"`)
  - `toExternalStatus()` — maps formal state → verify API response string (e.g., `PAYOUT_COMPLETE` → `"confirmed"`)
  - `toWebhookEvent()` — maps formal state → merchant webhook event name (e.g., `CONFIRMED` → `"payment.confirmed"`)
  - `validateTransition()` — soft enforcement (validates + logs, never throws, for gradual integration)
  - Round-trip consistency: `parseState(toRedisStatus(state))` always returns a valid state
- Created `__tests__/paymentStateMachine.test.ts` with 132 comprehensive unit tests covering:
  - 23 valid transitions, 22 invalid transitions, success/failure cases, terminal states
  - Full lifecycle paths (happy, auto-conversion, underpayment recovery, failure, refund)
  - Redis/external/webhook event mappings, soft enforcement, round-trip consistency
- All 511 tests passing across 15 suites

### Centralize Fee Logic (Completed - Feb 15, 2026)
- Created `services/feeService.ts` — single import point for all platform fee calculation
- Migrated 6 functions from `controller/index.ts`: getTransactionFee, getDiscountedTransactionFee, getBlockchainFee, getBlockchainConfig, calculateTransactionFees, calculateTransactionFeesWithDiscount
- Extracted shared `findMatchingTier()` helper (was duplicated between two functions)
- Updated 4 consumers to import directly from feeService: paymentController, walletController, thresholdTestController, server.ts
- Controller re-exports for backward compatibility (existing tests + imports unaffected)
- Created `__tests__/feeService.test.ts` with 28 comprehensive unit tests
- All 379 tests passing across 14 suites
