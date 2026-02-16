# DynoPay - Product Requirements Document

## Overview
DynoPay is a full-stack cryptocurrency payment platform with a React frontend and TypeScript/Node.js backend. It handles cryptocurrency payments via the Tatum API, merchant webhook delivery, and multi-chain support.

## Core Architecture
- **Frontend**: React (port 3000)
- **Backend**: TypeScript/Node.js/Express (ts-node, proxied via Python/uvicorn on port 8001)
- **Database**: PostgreSQL (primary), Redis (caching, queues, payment state)
- **Payments**: Tatum API for wallet generation, transaction monitoring, webhook notifications
- **Queue**: BullMQ for persistent webhook processing

## Credentials
- **User**: richard@dyno.pt / Katiekendra123@
- **Company ID**: 38 (Bozzmail)

## What's Been Implemented

### Payment State Machine (Completed - Feb 15, 2026)
- `services/paymentStateMachine.ts` — 11 states, soft + hard enforcement
- API status normalization: `payment_status` + `display_status` (additive, non-breaking)
- 132 unit tests, 511+ total tests passing

### Binance Conversion Reliability Overhaul (Completed - Feb 16, 2026)
- `MAX_RETRIES` increased 5 → 30 for slow chains (BTC confirmations)
- Transient API errors (geo-block, SOCKS, timeout) no longer burn retry count in all 3 phases
- Added `recoverTransientFailures()` — auto-resurrects FAILED records when Binance reconnects (72h window)
- `markExhaustedAsFailed()` skipped when Binance is unreachable
- Error messages now include actual text in logs

### TypeScript Error Fixes (Completed - Feb 16, 2026)
- Fixed `ErrorComponent` type mismatches in `reconciliation.ts` and `webhookQueue.ts`
- Fixed Redis `scan()` cursor type (string → number) in `reconciliation.ts`
- Zero TypeScript errors across entire codebase

### Test Payments (Completed - Feb 16, 2026)
- $10 BTC payment → #27, address: bc1qh2hhcesallu4fpfkvvhus3z3tkqmrtzn8n5rc9
- $10 ETH payment → #26, address: 0xdb0c01c41879d877654050002e6e6f283841c9c3
- Both received, swept, and conversion pipeline triggered
- ETH #26: COMPLETED end-to-end
- BTC #27: DEPOSIT_CREDITED (insufficient Binance BTC balance — not a code issue)

### Previously Completed
- Robust Offline Payment Processing (BullMQ + reconciliation)
- Unit Testing Framework (511+ tests, 15 suites)
- Auto-Stablecoin Conversion (Binance service, cron pipeline)
- Security Hardening, Fee Service, QR Code overlay, Error Alerts
- See CHANGELOG.md for full history

## Key Files
- `services/conversionService.ts` — Auto-conversion pipeline (deposit→convert→withdraw)
- `services/paymentStateMachine.ts` — Payment state machine
- `services/webhookProcessor.ts` — Core webhook processing
- `services/reconciliation.ts` — Startup reconciliation
- `services/webhookQueue.ts` — BullMQ queue + worker
- `services/binanceService.ts` — Binance API client
- `controller/paymentController.ts` — Payment endpoints
- `webhooks/index.ts` — Webhook handlers

## Backlog
- **P2: Enhanced Monitoring** — Alerting for state machine audit logs
- **P2: Scaling for 500 payments** — Pool pre-warming, DB pool increase, BullMQ concurrency, Node.js clustering
- **P3: Dependency Injection** — Decouple services for testability
