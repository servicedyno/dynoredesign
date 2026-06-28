# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-28 — Profile Settings Refactor with OTP-based Updates (P0)
- **Account Settings refactored**: First Name and Last Name fields are now **read-only/disabled** with a tooltip and notice "To update your name, please contact support." Email and Phone fields show current values as read-only with "Change"/"Add" buttons that open inline OTP-verified update forms.
- **Update Password refactored**: Two modes based on `has_password` flag from profile API:
  - Users **with** password: See old password + new password form, with "Use OTP instead" link
  - Users **without** password (OTP-registered): See "Verify Identity to Set Password" button → OTP verification → set new password
- **Backend changes**:
  - `GET /api/user/profile` now returns `has_password: boolean` field
  - `POST /api/user/profile/request-password-otp` — sends OTP to user's registered email/phone for identity verification
  - `POST /api/user/profile/set-password` — verifies OTP and sets/updates password (with strength validation)
- **Files updated**: `userController.ts` (+182 lines), `userRouter.ts` (+4 lines), `AccountSetting.tsx` (rewritten), `UpdatePassword.tsx` (rewritten)
- **Verified**: 92% backend pass rate (12/13, 1 skipped for SMS service), 100% frontend pass rate (all UI elements verified). Test report at `/app/test_reports/iteration_10.json`.

### 2026-06-28 — Dark/Light Mode SVG Icon Fix & Mobile Responsiveness (P0)
- **Root cause**: 87 SVG files in `/app/assets/Icons/` had hardcoded dark fills (`#242428`, `#676768`, `#0004FF`) that were invisible on dark backgrounds. Many `<Image>` components also had hardcoded CSS filter styles (`brightness(0) invert(0%)`) that prevented theme adaptation.
- **Fix**: Added global CSS classes `.themed-icon` (dark fills → light gray in dark mode) and `.themed-icon-primary` (blue fills → lighter blue in dark mode) to `globals.css`. Updated 25 component files to use these classes instead of hardcoded filters.
- **Verified**: 100% pass rate on 8 frontend test scenarios (desktop + mobile, light + dark mode).

### 2026-06-28 — P0 FIX: Dashboard 500s for empty/new merchants
- **Root cause**: `tbl_user_self_transaction` table was never created in this DB — its model existed but `selfTransactionModel.sync(...)` was missing from server.ts startup sync list.
- **Fix**: Added `selfTransactionModel.sync(syncOptions)` to server.ts startup.
- **Verified**: All dashboard endpoints return 200 with zeroed empty-state data for new merchants.

### 2026-06-28 — paymentController refactor: blockchain payment-flow chain extracted (Phase 1 + 2)
- Extracted ~4,648 lines into `cryptoSettlement.ts` and `cryptoCheckout.ts` modules
- `paymentController.ts`: 6,855 → 2,199 lines (75% smaller than the 8,932-line original)
- **Verified**: 14 suites / 469 tests PASS, zero refactor regressions

### 2026-06-27 — MUI Emotion SSR Hydration Fix (app-wide) + paymentController refactor (started)
- Fixed systemic MUI hydration mismatch with cookie-based theme + emotion SSR cache
- Started paymentController refactoring: 8932 → 6849 lines (~23% reduction)

### 2026-06-27 — Onboarding Drop-off Analytics
- New table `tbl_onboarding_event`, write endpoint, admin funnel analytics

### 2026-06-27 — Onboarding Flow Hardening + Auth Logo Hydration Fix
- Migrated readiness gating to Redux `fetched` flags
- Per-session auto-open guard for company modal

### Earlier Fixes
- 2026-03-25: Critical Double SUN→TRX Conversion Fix (Fee Wallet Drain)
- 2026-03-23: Auto-Convert Icon Fix
- 2026-03-01: Critical Bug Fix & Fund Recovery (TRON OUT_OF_ENERGY)
- 2026-02-XX: Cron Worker Isolation & Lock Coverage
- 2026-02-XX: Code Cleanup (97 archived scripts deleted, unused imports removed)

## Prioritized Backlog

### P1 — Upcoming
- **Merchant Webhook 404:** Debug and fix failing webhook at merchant URL
- **Landing page "Network Error" (USER ACTION)**: needs a clean Railway frontend rebuild

### P2 — Future
- Low gas balance alerting (Slack/email)
- Improved webhook retry logic and dead letter queue
- Admin dashboard for stuck payment visibility
- Further `paymentController.ts` refactoring (alt-payment handlers, addPayment dispatcher, cron jobs)

### Open bugs (from prior handoff)
- **P1 — Merchant webhook 404**: outbound webhook to merchant URL returning 404
- **P2 — Landing page "Network Error" (USER ACTION)**: needs a clean Railway frontend rebuild
