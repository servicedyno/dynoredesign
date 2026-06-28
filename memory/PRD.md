# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-28 — P0 FIX: Dashboard 500s for empty/new merchants
- **Root cause**: `tbl_user_self_transaction` table was never created in this DB — its model (`models/userModels/selfTransactionModel.ts`) existed and was exported, but `selfTransactionModel.sync(...)` was missing from the server.ts startup sync list (its inline sync was commented out). `getDashboard` (selfCountQuery) and `getUserAnalytics` (`selfTransactionModel.findAndCountAll`) both query it → `relation "tbl_user_self_transaction" does not exist` → 500.
- **Fix** (`server.ts`, after the onboarding-table sync): `const { selfTransactionModel } = await import("./models/userModels"); await selfTransactionModel.sync(syncOptions);`. Non-destructive — `syncOptions = isProduction ? {} : {alter:true}`, so production only creates the table if missing (never alters/drops data).
- **Verified** (fresh verified merchant user_id=8, no company/wallet/txn): GET `/api/dashboard` → **200** zeroed; POST `/api/wallet/getUserAnalytics` → **200** empty; `/api/dashboard/{chart,fee-tiers,recent-transactions,conversions}` → **200**. Startup log: "Self-transaction table synced successfully." `tsc --noEmit` 0 errors; backend boots clean.


### 2026-06-28 — paymentController refactor: blockchain payment-flow chain extracted (Phase 1 + 2)
- **Resumed the in-progress `paymentController.ts` refactor (zero behavior change).** Extracted the tightly-coupled blockchain payment-flow chain the prior handoff named, into two new modules under `backend/controller/payment/`:
  - **`cryptoSettlement.ts`** (Phase 1, ~2,818 lines moved): `settleCryptoTransaction`, `verifyCryptoPayment`, `cryptoVerification`. These three only call each other (verified via a full call-graph analysis) → clean, no circular dependency.
  - **`cryptoCheckout.ts`** (Phase 2, ~1,830 lines moved): `getData`, `Crypto`, `createCryptoPayment`, `confirmPayment`. These call only each other; `addPayment` (stays) imports `Crypto`/`createCryptoPayment` from it → one-directional, no circular dep.
- **`paymentController.ts`: 6,855 → 2,199 lines this session (75% smaller than the 8,932-line original).** Functions are re-imported into `paymentController.ts` and re-exported via its default object, so **all routes are unchanged**.
- **Extraction method**: byte-exact verbatim move (script-driven), no logic edits. Inline `require()/import()` relative paths inside moved bodies were path-corrected for the new `controller/payment/` directory (`../services/…` → `../../services/…`, `../utils/feeConfigUtils` → `../../utils/feeConfigUtils`).
- **Verified**:
  - `tsc --noEmit`: 0 errors after each phase.
  - Jest unit harness: **14 suites / 469 tests PASS** (incl. `webhookProcessor`, `webhookHandlers` which load the full `paymentController` import graph) — zero refactor regressions.
  - Node backend boots clean (`ts-node --transpile-only`): PostgreSQL connected, proxy ready, no module-resolution errors → proves all re-exported handlers are bound and every import path resolves at runtime.
  - Route smoke test via proxy: `/api/pay/{createCryptoPayment,confirmPayment,verifyCryptoPayment}` return handled 403 (auth/bot middleware), `getData` returns handled 400 — no 500s.
- **Note (env)**: jest full-suite runs are slow under this preview's transport; used a throwaway `jest.fast.config.ts` (isolatedModules) for fast runs and removed it afterward. Standard `yarn test` config is untouched.


### 2026-06-27 — MUI Emotion SSR Hydration Fix (app-wide) + paymentController refactor (started)
- **Systemic MUI hydration mismatch FIXED** (cookie-based theme + emotion SSR cache):
  - Root cause: MUI `theme.palette.mode` was always `'dark'` on the server but reflected the user's real theme on the client's first render → emotion generated different CSS class hashes → `className`/`srcSet` mismatch app-wide.
  - `contexts/ThemeContext.tsx`: `ThemeProvider` now takes an `initialMode` prop (server-resolved from a `theme-mode` cookie); removed the fragile `!mounted` branch; `toggleTheme` + mount reconcile now also write the cookie. Logo fix from earlier still in place.
  - `pages/_app.tsx`: added `App.getInitialProps` to read the `theme-mode` cookie server-side and pass `initialThemeMode`; wrapped tree in emotion `CacheProvider`.
  - `pages/_document.tsx`: rewritten with emotion SSR extraction (`@emotion/server` + shared `createEmotionCache`); blocking theme script now also seeds the `theme-mode` cookie. Kept all existing head/lang/theme scripts.
  - `utils/createEmotionCache.ts` (new). Added `@emotion/cache` + `@emotion/server`.
  - Added `data-testid="theme-toggle-button"` to `ThemeToggle`.
  - **Verified**: NO hydration warnings on `/auth/login` (light) or `/dashboard` (dark); theme toggle switches + persists across reloads via cookie SSR.
- **`paymentController.ts` incremental refactor (in progress, zero behavior change): 8932 → 6849 lines (~23% reduction).** New `backend/controller/payment/` module:
  - `paymentConfig.ts`: PAYMENT_TIMING, ADMIN_CONFIG, RETRY_CONFIG, TAX_DATA_API_URL/KEY.
  - `paymentHelpers.ts`: `convertToUSD`, `withRetry`, `getCryptoPriceForPayment`.
  - `taxService.ts`: `calculateTaxForCheckout`.
  - `paymentTokens.ts`: `getLinkAccessToken`, `getAccessToken`.
  - `feeController.ts`: `getNetworkFees`, `calculatePaymentAmount`, `getConfiguredCurrenciesForCheckout`, `calculateCheckoutFees`, `getFeePreview`, `getCompanyConfiguredCurrencies` (re-exported from paymentController so routes are unchanged).
  - `paymentLinkController.ts`: `createPaymentLink`, `getPaymentLinks`, `getPaymentLinkById`, `updatePaymentLink`, `deletePaymentLink` (re-exported).
  - **Verified after each slice**: backend tsc 0 errors, restarts clean, `POST /api/pay/calculateFees` identical breakdown, `GET /api/pay/getPaymentLinks` returns 200.
  - **Validated by existing Jest harness**: my 2 refactor commits touched ONLY `payment/*` + `paymentController.ts` (+ frontend). Payment suites that load paymentController (`paymentWalletFlows`, `coreServices`) PASS → zero refactor regressions. 
  - **Harness fix (test-only)**: `webhookHandlers.test.ts` + `webhookProcessor.test.ts` mocked `../utils/loggers` without `log` (source now calls `log()`), causing ~47 false `loggers.log is not a function` failures — added `log: jest.fn()`; those suites now 76/77 pass.
  - **Remaining PRE-EXISTING test failures (NOT from refactor, NOT yet fixed)**: 1 stale webhook-payload assertion (impl now sends signature/webhook_id/timeout 15000); `paymentStateMachine.test` external-status assertion drift; `adminFlows`/`realTimeEvents` integration tests fail on env (no admin account / 500).

### 2026-06-27 — Onboarding Drop-off Analytics (self-contained, no 3rd party)
- **New table** `tbl_onboarding_event` (`backend/models/onboardingEventModel.ts`): user_id, event_type, step_key, completed_count, metadata, timestamps. Synced on startup in `server.ts`.
- **Write endpoint** `POST /api/track/onboarding` (auth-required, in `trackRouter.ts`): records events `checklist_shown | step_clicked | step_completed | dismissed | collapsed | expanded`. High-frequency events deduped via Redis (checklist_shown 6h, step_completed 30d). Validates event_type; always responds 200 (never blocks UI).
- **Admin funnel** `GET /api/admin/analytics/onboarding?days=30` (`analyticsController.onboardingFunnel`, `analyticsRouter.ts`): distinct-user funnel (saw_checklist → clicked_* → completed_* → dismissed/collapsed) + raw_event_counts.
- **Frontend** (`utils/trackOnboarding.ts` fire-and-forget helper) instrumented in `OnboardingFlow/index.tsx` (shown, step clicks, company/wallet completion, dismiss) and `OnboardingChecklist.tsx` (collapse/expand).
- **Verified end-to-end**: events fire from browser → recorded → funnel aggregates correctly; dedup, invalid-event, and no-auth guards confirmed.

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
- **Refactoring of `paymentController.ts`**: blockchain payment-flow chain extracted (now 2,199 lines, was 8,932). Remaining optional extractions: alt-payment handlers (`cardPayment`, `bankTransfer`, `bankAccount`, `googleApplePay`, `USSD`, `MobileMoney`, `QRCode`, `userWallet`), `addPayment` dispatcher, and cron/maintenance jobs (`checkingUSDT`, `sweepNativeAdminFees`, `checkFeeBalance`, `processIncompletePayments`).

### Open bugs (from prior handoff)
- ~~**P0 — Dashboard 500s for empty/new merchants**~~ ✅ FIXED 2026-06-28 (missing `tbl_user_self_transaction` table now synced on startup).
- **P1 — Merchant webhook 404**: outbound webhook to merchant URL returning 404; verify routing/payload targeting in `webhooks/index.ts`.
- **P2 — Landing page "Network Error" (USER ACTION)**: needs a clean Railway frontend rebuild to bake the new `NEXT_PUBLIC_BASE_URL`.

### 2026-02-XX — Cron Worker Isolation & Lock Coverage (P1)
- Added `WORKER_ROLE=primary|secondary` env var system for multi-environment isolation
  - `primary` (DO) → runs all cron jobs, sweeps, webhook migration, reconciliation
  - `secondary` (Railway) → API-only, zero cron jobs
  - Backward compatible: unset defaults to `primary`
- Added Redis distributed locks (`acquireLock/releaseLock`) to ALL 16 cron jobs (was 10/16)
  - Newly locked: `checkingUSDT`, `sweepNativeAdminFees`, `checkFeeBalance`, `removeUnwantedSubscriptions`, `releaseExpiredReservations`, `cleanupStaleAddresses`, `ensurePoolSubscriptions`, `prewarmPoolAddresses`, `paymentWatchdog`, `webhookRetryQueue`
- `refreshBackgroundRateCache` (always-on, idempotent) intentionally left unlocked — runs on both environments
- Updated DO app spec (`app.yaml`, `app-create.json`) with `WORKER_ROLE=primary`
- **Railway action required:** Set `WORKER_ROLE=secondary` in Railway environment variables
- Cross-referenced all `process.env.*` usage in backend codebase against DO App Spec (`app.yaml`/`app-create.json`)
- **Added 8 missing variables to DO spec:** `CORS_ALLOWED_ORIGINS`, `TELNYX_PHONE_NUMBER`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`
- 13 other code-referenced variables have graceful fallbacks or are script-only — documented in `/app/docs/DO_ENV_AUDIT.md`
- Confirmed 160 env vars in DO spec now, YAML and JSON in sync, no duplicates
- All dynamically accessed vars (FEE_TIER, SWEEP, THRESHOLD, TRIAL) confirmed present
