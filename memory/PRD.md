# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.

## What's Been Implemented

### 2026-06-28 — Dark Mode & UI/UX QA Fixes
- **Bug Fix 1 (Critical)**: Dashboard crash — `user_image.png` relative path without leading `/` crashed Next.js `<Image>` component. Fixed in Header, AdminHeader, UserMenu, AccountSetting (4 files).
- **Bug Fix 2 (High)**: Empty state text invisible in dark mode — `EmptyDataModel` used hardcoded `#242428` / `#676768` colors. Fixed to `theme.palette.text.primary` / `theme.palette.text.secondary`.
- **Bug Fix 3 (Medium)**: `NoData` subtext barely visible in dark mode — changed `text.disabled` to `text.secondary`.
- **Bug Fix 4 (Medium)**: Payment-link `TableBodyCell` hardcoded `#242428`. Fixed to `theme.palette.text.primary`.
- **Bug Fix 5 (Medium)**: Wallet dialog hardcoded text/border colors. Fixed to theme-aware `text.secondary` / `divider`.
- **Verified**: Testing agent Iteration 14 — all 5 fixes verified, 8 pages tested in both light/dark modes, all PASS.

### 2026-06-28 — Password Update OTP Bug Fixes
- Removed "current password" requirement, replaced with OTP channel selector (email/phone)
- Fixed OTP dialog close (X) button overflow clipping
- Changed OTP button text to "Verify" + auto-submit on 6-digit completion
- **Verified**: Testing agent Iteration 13

### 2026-06-28 — Email Template Standardization (Dark Mode)
- Dark mode CSS overhaul for `baseEmailTemplate` with 60+ dark mode overrides
- 11 new email helper functions (warnText, alertBox, statCard, feeTable, etc.)
- Converted all templates to use `dynoPayEmailTemplate`. Removed Inter font references.
- **Verified**: Iteration 12

### 2026-06-28 — Login Activity Notifications & History
- Email notification on every login (device/browser/OS/IP/geolocation, "Not you?" link)
- Login Activity section on Profile page (paginated, with device icons, location, flagged badges)
- Secure account flow (`/auth/secure-account?token=<token>`)

### 2026-06-28 — Profile Settings Refactor with OTP-based Updates
- Account Settings: Name fields read-only, Email/Phone with OTP-verified Change/Add
- Update Password: OTP identity verification only (no old password required)
- Backend: `has_password`, `request-password-otp`, `set-password` endpoints

### Earlier Work
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
