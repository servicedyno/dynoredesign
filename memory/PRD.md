# DynoPay - Cryptocurrency Payment Gateway PRD

## Original Problem Statement
Build a production-grade cryptocurrency payment gateway with:
1. Multi-chain support (BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20/ERC20, USDC-ERC20)
2. Merchant pool address system for address reuse
3. Fee payer model (company or customer absorbs fees)
4. Real-time webhook notifications
5. Robust retry mechanisms for blockchain operations
6. Automatic admin fee sweeping

## Core Requirements
- **Per-merchant address pools** with HD wallet derivation
- **Fee distribution**: 33% admin, 67% merchant (configurable via fee_payer)
- **Time-based sweep** for account chains (ETH/TRX)
- **Threshold-based sweep** for tokens (USDT/USDC)
- **Batch transfer** for UTXO chains (BTC - merchant + admin in single TX)
- **Smart retries** with exponential backoff for blockchain operations

## Architecture Overview
```
/app/backend/
├── controller/paymentController.ts    # Payment creation, verification, settlement
├── services/merchantPoolService.ts    # Address pool management, sweeping logic
├── webhooks/index.ts                  # Incoming Tatum webhooks, merchant webhooks
├── models/merchantPoolModels/         # Database schemas for pool system
└── server.ts                          # Cron jobs for sweeping and cleanup
```

## What's Been Implemented

### Session 1 (Initial Development)
- Merchant pool address system with lazy xpub generation
- Address reservation, release, and reuse logic
- Fee calculation with fee_payer model
- Basic webhook handling

### Session 2 (Hardening - December 2024)
- Fixed critical payment failures (payment_id/unique_tx_id mismatch)
- Fixed webhook race conditions (txId persistence before verification)
- Added IN_USE status to address model
- Implemented smart retries with exponential backoff
- Added retry wrappers to merchant payouts and admin sweeps
- Tuned cron jobs (1-minute sweep frequency)
- Implemented merchant webhook notifications (payment.pending, payment.confirmed)
- Fixed pending payment email issues
- Successfully tested BTC (UTXO) and ETH (account chain) flows
- Implemented fee_payer='customer' mode

### Session 3 (Current - December 2024)
- **Fixed P0**: Added missing `webhook_url` and `webhook_secret` columns to `tbl_company`
- **Analyzed P1**: Confirmed 3 transactions for ETH is by design (incoming, merchant payout, admin sweep)

## Environment Configuration
```env
# Sweep Configuration (per-chain)
ETH_SWEEP=time:3      # Time-based sweep, 3 minutes after merchant payout
TRX_SWEEP=time:3      # Time-based sweep, 3 minutes
# USDT-TRC20 uses default threshold:30 (sweep when admin fees > $30 USD)
```

## Key Technical Concepts
1. **Smart Retries**: `withRetry` helper with exponential backoff, distinguishes retryable vs non-retryable errors
2. **Idempotent Webhooks**: Redis keys (`processed-tx-{txId}`) prevent duplicate processing
3. **Self-Healing Cron Jobs**: Automatic recovery of stuck SWEEPING addresses
4. **Chain-Specific Logic**: UTXO (batch), Account (time-based sweep), Token (threshold-based)

## Database Schema Changes
- `tbl_merchant_temp_address.status`: Added 'IN_USE' state
- `tbl_company`: Added `webhook_url` (VARCHAR 500), `webhook_secret` (VARCHAR 100)

## 3rd Party Integrations
- **Tatum**: Blockchain interactions (wallet generation, transactions, webhooks)
- **Brevo**: Transactional emails

## Pending Tasks (P0/P1)
- None currently

## Recently Completed (January 2026)
1. ✅ Added `webhook_url` and `webhook_secret` columns to `tbl_company`
2. ✅ Implemented HMAC-SHA256 webhook signature verification (OPTIONAL - secret not required)
3. ✅ Added webhook management APIs (GET/PUT settings, POST test)
4. ✅ Added retry logic with exponential backoff for webhook delivery
5. ✅ Created merchant integration documentation
6. ✅ Implemented webhook delivery logs table (`tbl_webhook_delivery_log`)
7. ✅ Added webhook history API with pagination and filtering
8. ✅ Added webhook statistics API with daily breakdown

## Backlog (P2+)
1. Failed webhook queue with manual retry option
2. Webhook event filtering (subscribe to specific events only)
3. Add dashboard for monitoring sweep status
4. Add admin fee recovery for stranded gas

## Testing Checklist
- [ ] ETH payment (fee_payer='customer') - verify no webhook errors
- [ ] BTC payment - verify 2 transactions (batch)
- [ ] Webhook delivery test to external URL
