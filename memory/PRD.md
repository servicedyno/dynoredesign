# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-06-28 — Login Activity Notifications & History (P1)
- **Login activity recording**: Every successful login via `verifyLoginOTP` now records device, browser, OS, IP, geo-location, and a one-time security token in `tbl_login_activities`.
- **Email notification on every login**: Uses new `sendLoginNotificationEmail` email template via Brevo. Includes device info, location, IP, time, and a "This wasn't me — Secure my account" button with a unique security token link.
- **Login Activity history page**: New `LoginActivity.tsx` component on the Profile page shows paginated history of all logins with device icons, browser/OS info, location, IP, relative timestamps, and flagged status badges.
- **"Not you?" security flow**: New `/auth/secure-account?token=<token>` public page. When clicked from the email, it calls `POST /api/user/security/flag-login` which: (1) marks the login as flagged, (2) temporarily locks the account for 24 hours via Redis, (3) sends a security alert email. One-time tokens cannot be reused.
- **Backend endpoints**: `GET /api/user/login-activity` (auth, paginated), `POST /api/user/security/flag-login` (public, CSRF-exempt, one-time token).
- **Files created/updated**: `loginActivityModel.ts`, `LoginActivity.tsx`, `secure-account.tsx`, `userController.ts`, `userRouter.ts`, `csrfMiddleware.ts`, `emailService.ts`, `server.ts`, `models/index.ts`.
- **Verified**: 100% backend (10/10), 100% frontend. Test report at `/app/test_reports/iteration_11.json`.

### 2026-06-28 — Profile Settings Refactor with OTP-based Updates (P0)
- **Account Settings**: First Name & Last Name read-only with "Contact support" notice. Email/Phone show current value with "Change"/"Add" buttons → inline OTP-verified update forms.
- **Update Password**: Dual-mode — users with password see old-password form + "Use OTP instead" link; users without password see OTP identity verification → set password. Backend: `has_password` on profile, `request-password-otp` and `set-password` endpoints.
- **Verified**: 92% backend (12/13, 1 SMS skip), 100% frontend. Test report at `/app/test_reports/iteration_10.json`.

### Earlier Work (same session)
- Dashboard stats skeleton loading fix, registration page UI fix, phone registration validation, login page UI fix
- Forgot Password → OTP flow refactor (Telnyx SMS + Brevo email)
- Onboarding → OTP-only registration (email/phone, no password)
- Company Creation → collects First Name / Last Name

### Older Fixes
- Dark/Light mode SVG icon fix, Dashboard 500s for new merchants, paymentController refactor
- MUI Emotion SSR hydration fix, Onboarding analytics, Auth logo fix
- Critical TRON OUT_OF_ENERGY fix, fee wallet drain fix, cron worker isolation

## Prioritized Backlog

### P1 — Upcoming
- Merchant webhook 404 debugging
- Landing page "Network Error" (needs Railway frontend rebuild — user action)

### P2 — Future
- Low gas balance alerting (Slack/email)
- Webhook retry logic improvements + dead letter queue
- Admin dashboard for stuck payment visibility
- Further `paymentController.ts` refactoring
