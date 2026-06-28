# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-28 — Email Template Standardization (End-to-End Dark Mode)
- **Dark mode CSS overhaul**: Enhanced `baseEmailTemplate` with 60+ dark mode CSS overrides covering ALL child element types (div, span, table td, stat cards, fee tables, alert/error/success/neutral boxes, OTP blocks, monospace text, section borders).
- **11 new helper functions**: `warnText()`, `alertBox()`, `errorBox()`, `successBox()`, `neutralBox()`, `statCard()`, `twoColumnStats()`, `feeRow()`, `feeTotalRow()`, `feeTable()`, `mono()` — all with dark mode CSS classes.
- **Template cleanup**: Converted all 7 `dynoPayGreetingTemplate` calls to `dynoPayEmailTemplate`. Replaced all `p(..., 'color: #991b1b')` warning text with `warnText()` helper. Removed all `'Inter'` font references, standardized on system font stack.
- **Refactored complex templates**: Auto-conversion payout email (largest template) and weekly conversion summary now use new helper functions with proper dark mode class bindings.
- **Verified**: 100% backend tests (11/11), TypeScript compiles cleanly, email sending confirmed in logs.

### 2026-06-28 — Login Activity Notifications & History
- Email notification on every login via Brevo with device/browser/OS/IP/geolocation and "Not you? Secure my account" one-time security link.
- Login Activity history section on Profile page (paginated, with device icons, location, flagged badges).
- `/auth/secure-account?token=<token>` page for "Not you?" flow — flags login, locks account 24h, sends security alert.
- Endpoints: `GET /api/user/login-activity`, `POST /api/user/security/flag-login`.

### 2026-06-28 — Profile Settings Refactor with OTP-based Updates
- Account Settings: Name fields read-only, Email/Phone with OTP-verified Change/Add buttons.
- Update Password: Dual-mode (old password or OTP identity verification).
- Backend: `has_password` on profile, `request-password-otp` and `set-password` endpoints.

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
