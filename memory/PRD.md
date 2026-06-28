# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-28 — Password Update OTP Bug Fixes
- **Bug Fix 1**: Removed "current password" field from Update Password flow. Replaced with OTP channel selector (email/phone). Backend `requestPasswordOtp` now accepts optional `{ channel }` body parameter.
- **Bug Fix 2**: Fixed OTP dialog close (X) button — added `overflow: "visible"` to `MuiDialog-paper` sx props.
- **Bug Fix 3**: Changed OTP button label default from "Check and add" to "Verify". Auto-submit now triggers immediately when all 6 digits are entered (removed `submitDisable` check).
- **Verified**: Testing agent Iteration 13 — 10/13 backend tests passed (3 skipped due to rate limiting), all frontend checks passed.

### 2026-06-28 — Email Template Standardization (End-to-End Dark Mode)
- **Dark mode CSS overhaul**: Enhanced `baseEmailTemplate` with 60+ dark mode CSS overrides covering ALL child element types.
- **11 new helper functions**: `warnText()`, `alertBox()`, `errorBox()`, `successBox()`, `neutralBox()`, `statCard()`, `twoColumnStats()`, `feeRow()`, `feeTotalRow()`, `feeTable()`, `mono()`.
- **Template cleanup**: Converted all `dynoPayGreetingTemplate` calls to `dynoPayEmailTemplate`. Removed all `'Inter'` font references.
- **Verified**: 100% backend tests (11/11), TypeScript compiles cleanly.

### 2026-06-28 — Login Activity Notifications & History
- Email notification on every login via Brevo with device/browser/OS/IP/geolocation and "Not you? Secure my account" one-time security link.
- Login Activity history section on Profile page (paginated, with device icons, location, flagged badges).
- `/auth/secure-account?token=<token>` page for "Not you?" flow — flags login, locks account 24h, sends security alert.
- Endpoints: `GET /api/user/login-activity`, `POST /api/user/security/flag-login`.

### 2026-06-28 — Profile Settings Refactor with OTP-based Updates
- Account Settings: Name fields read-only, Email/Phone with OTP-verified Change/Add buttons.
- Update Password: OTP identity verification only (no old password required).
- Backend: `has_password` on profile, `request-password-otp` (with channel support) and `set-password` endpoints.

### Earlier Work (same session)
- Dashboard stats fix, registration UI fix, phone validation, login page UI fix
- Forgot Password → OTP flow, Onboarding → OTP-only registration
- Company Creation → collects First/Last Name

## Prioritized Backlog

### P1 — Upcoming
- Merchant webhook 404 debugging
- Landing page "Network Error" (needs Railway frontend rebuild — user action)

### P2 — Future
- Low gas balance alerting (Slack/email)
- Webhook retry logic + dead letter queue
- Admin dashboard for stuck payment visibility
- Further `paymentController.ts` refactoring
