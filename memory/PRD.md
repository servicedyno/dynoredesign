# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment gateway platform. Users can create companies, wallets, payment links, and accept crypto payments. The platform supports OTP-based authentication, profile management, login activity monitoring, and comprehensive dark/light mode theming.

## What's Been Implemented

### 2026-06-28 — Company Page Redesign & Settings Fix
- **Company Page**: Replaced old DataTable with modern card-based layout (matching wallet page pattern). Cards show company logo/initials, email, phone, website, location, and "Manage" button that opens `CompanySettingsDialog`. Empty state with business icon and "Add Company" CTA. Loading spinner with proper fallback via saga error handling fix.
- **Settings Page**: Redesigned from accordion to 8-card grid (3 columns desktop, 2 tablet, 1 mobile). Each card has colored icon, title, description, and navigates correctly: Company Profile→/company, Wallet Addresses→/wallet, Payment Settings→/company?section=payment, Webhook Configuration→/company?section=webhook, API Keys→/developer-keys, Profile & Security→/profile, Notifications→/notifications, My Account→/referrals.
- **Saga Error Fix**: Fixed all 4 catch blocks in `CompanySaga.ts` — changed `e.response.data.message` to `e?.response?.data?.message` to prevent crashes on network errors (CORS, timeouts).
- **Verified**: Testing agent Iteration 15 — all features verified, 100% frontend pass rate.

### 2026-06-28 — Dark Mode & UI/UX QA Fixes
- Dashboard crash from `user_image.png` relative path (4 files fixed)
- Empty state text invisible in dark mode — `EmptyDataModel`, `NoData`, `PaymentLink`, `Wallet` dialog all fixed to use theme-aware colors
- **Verified**: Testing agent Iteration 14

### 2026-06-28 — Password Update OTP Bug Fixes
- Removed "current password" requirement, replaced with OTP channel selector
- Fixed OTP dialog close button overflow, "Verify" text, auto-submit
- **Verified**: Testing agent Iteration 13

### 2026-06-28 — Email Template Standardization
- Dark mode CSS overhaul, 11 new helper functions, converted all templates
- **Verified**: Iteration 12

### 2026-06-28 — Login Activity & Profile Settings
- Login notification emails, Login Activity section on Profile, Secure Account flow
- Profile: OTP-based email/phone/password updates
- **Verified**: Iterations 10-11

### Earlier Work
- Dashboard stats, registration UI, phone validation, login page fixes
- Forgot Password OTP, Onboarding OTP-only, Company Creation with Name fields

## Prioritized Backlog

### P1 — Upcoming
- Merchant webhook 404 debugging
- Landing page "Network Error" (needs Railway frontend rebuild — user action)

### P2 — Future
- Low gas balance alerting (Slack/email)
- Webhook retry logic + dead letter queue
- Admin dashboard for stuck payment visibility
- Further `paymentController.ts` refactoring
