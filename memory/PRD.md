# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-27 — Onboarding Flow Hardening + Auth Logo Hydration Fix
- **Onboarding (`Components/UI/OnboardingFlow/index.tsx`)**: Migrated readiness gating from fragile React refs/loading-timing to Redux `fetched` flags. `coreReady = companyReducer.fetched && walletReducer.fetched`; `payLinkFetched = paymentLinkReducer.fetched`. All three reducers now set `fetched: true` on BOTH fetch success and API error (added `fetched` to `paymentLinkReducer.ts`), so a failed fetch never leaves the checklist stuck/hidden.
- **Per-session auto-open guard**: Wired up the previously-unused `AUTO_OPEN_SESSION_KEY` via `sessionStorage`. Brand-new users (no company AND no wallet) get the company modal auto-opened ONCE per session; reloads and dismissals no longer re-pop it.
- **Verified end-to-end** (throwaway merchant user_id=3): new-user → checklist visible + company modal auto-opens; reload → no re-open; after company created → company step checked, wallet step unlocked, link step locked, no auto-open. No hydration errors introduced by onboarding.
- **Auth logo hydration fix (`pages/auth/login.tsx`, `pages/auth/register.tsx`)**: The theme-dependent logo (`theme.palette.mode === 'dark' ? WhiteLogo : Logo`) mismatched SSR (always 'dark') vs first client render. Gated behind a `mounted` flag so SSR and first client render agree. Logo `srcSet` hydration warning resolved.
- **Known remaining (out of scope)**: Systemic MUI emotion className SSR mismatch (`css-xxx`) persists app-wide because `theme.palette.mode` differs server vs client; needs emotion SSR cache setup or cookie-based theme. Dashboard `/api/wallet/getUserAnalytics` and `/api/dashboard` return 500 for brand-new merchants with no data.


### 2026-03-25 — Critical Bug Fix: Double SUN→TRX Conversion (Fee Wallet Drain)
- **Root Cause**: `tatumApi.getAddressBalance()` was fixed on ~March 15 to convert SUN→TRX (÷1M), but 4 caller sites still had their own ÷1M, making TRX balances appear 1,000,000× smaller
- **Impact**: `fundGasIfNeeded` always thought pool addresses had 0 gas → kept draining the fee wallet. `checkFeeBalance` reported $0 instead of actual ~$21 balance
- **Fix**: Removed extra `/1000000` in `merchantPoolSweep.ts`, `paymentController.ts` (×2), `adminController.ts`
- **On-chain proof**: Fee wallet had 69.4 TRX (~$21) but code reported 0.000069 TRX (~$0)

### 2026-03-23 — Auto-Convert Icon Fix
- Fixed auto-convert icon visibility in `TransactionsTable.tsx` and `TransactionDetailsModal.tsx`
- Updated references from legacy `"done"` status to `"settled"` to match the refactored status system

### 2026-03-01 — Critical Bug Fix & Fund Recovery
1. **Bug Fix (tatumApi.ts):** `waitForTransactionConfirmation` now validates `ret[0].contractRet === 'SUCCESS'` for TRON transactions
2. **Retry Logic (paymentController.ts):** Settlement retries on TRON execution errors like `OUT_OF_ENERGY`
3. **Recovery Endpoint (diagnosticsRouter.ts):** Rewrote `/diagnostics/recover-stuck-payment` to use correct data models
4. **Fund Recovery Executed:** Successfully recovered 98.7577 USDT from stuck payment
5. **Data Consistency Fix (paymentController.ts):** `recordPoolTransaction` now stores actual post-gas `sendAmount`

### Previous Session — Comprehensive Bug Fixing
- 13+ bugs fixed: registration validation, payment link creation, wallet management
- Auto API key creation on onboarding
- TRON `OUT_OF_ENERGY` fix and stuck payment recovery
- Gas drain fix with funding cap
- Webhook & status refactoring (`payment.confirmed` / `payment.settled`)
- Frontend status system: `pending`, `confirmed`, `processing`, `settled`, `failed`

## Prioritized Backlog

### P1 — Upcoming
- **TRX Hot Wallet:** ~~Investigate why gas wallet depletes, add monitoring/alerts~~ FIXED (2026-04-02): FeeWalletMonitor now checks the correct DB wallet
- **Merchant Webhook 404:** Debug and fix failing webhook at `lockbaypaymentfixing-production.up.railway.app/webhook/dynopay`

### P2 — Future
- Low gas balance alerting (Slack/email)
- Improved webhook retry logic and dead letter queue
- Admin dashboard for stuck payment visibility
- Refactoring of `paymentController.ts` (8,500+ lines) into smaller services
