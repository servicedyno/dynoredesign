# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-03-01 — Critical Bug Fix & Fund Recovery
1. **Bug Fix (tatumApi.ts):** `waitForTransactionConfirmation` now validates `ret[0].contractRet === 'SUCCESS'` for TRON transactions
2. **Retry Logic (paymentController.ts):** Settlement retries on TRON execution errors like `OUT_OF_ENERGY`
3. **Recovery Endpoint (diagnosticsRouter.ts):** Rewrote `/diagnostics/recover-stuck-payment` to use correct data models (`merchantTempAddressModel` + `merchantPoolTransactionModel` instead of broken `customerTransactionModel` lookup). Supports `payment_id`, `temp_address`, and manual override params.
4. **Fund Recovery Executed:** Successfully recovered 98.7577 USDT from `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` → `TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR` (TX: `7995bdcf...`, block 80553581, contractResult: SUCCESS)

## Prioritized Backlog

### P1 — Upcoming
- **TRX Hot Wallet:** Investigate why gas wallet depletes, add monitoring/alerts
- **Merchant Webhook 404:** Debug and fix failing webhook at `lockbaypaymentfixing-production.up.railway.app/webhook/dynopay`

### P2 — Future
- Low gas balance alerting (Slack/email)
- Improved webhook retry logic and dead letter queue
- Admin dashboard for stuck payment visibility
