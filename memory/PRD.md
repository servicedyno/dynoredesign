# DynoPay - Product Requirements Document

## Overview
DynoPay is a crypto payment gateway that enables merchants to accept cryptocurrency payments with ease. It provides a comprehensive API for payment processing, wallet management, and business analytics.

## Tech Stack
- **Backend**: Node.js/TypeScript (Express) — proxied through Python/uvicorn for Kubernetes compatibility
- **Database**: PostgreSQL (Sequelize ORM) + Redis (caching, rate limiting, locks)
- **Frontend**: React
- **Infrastructure**: Kubernetes, Railway deployment support

## Core Features (Implemented)
- User authentication (email/password, Google OAuth, Facebook, Telegram, Phone/OTP)
- Company management and multi-tenant architecture
- Crypto wallet management (15 cryptocurrencies across 7 networks)
- Payment links and direct API payments
- Webhook delivery with retry, DLQ, and signature verification
- Admin panel with user/transaction management
- KYC integration (Veriff)
- Subscription management
- Tax rate calculations
- Invoice generation (PDF)
- Referral system (user codes + referee codes)
- Knowledge base system
- Status page / service health monitoring
- Auto-stablecoin conversion via Binance
- Merchant pool address system
- Volatility monitoring
- Error monitoring and alerting

## Security Features (Implemented)
- Two-Factor Authentication (2FA/TOTP) with backup codes
- Refresh Token Rotation
- Session Management (list, revoke, login history)
- Account Lockout (Redis-based, with admin unlock)
- CSRF Protection (Double Submit Cookie pattern)
- Rate Limiting (per-IP, per-email, per-endpoint)
- Input Sanitization (XSS prevention)
- Webhook HMAC signature verification

## What's Been Implemented

### Feb 16, 2026 — API Documentation Update (P0)
- Created Swagger path files for 19 new endpoints:
  - `swagger/paths/security.ts` — CSRF token, 2FA (6 endpoints), sessions (5 endpoints), login history
  - `swagger/paths/analytics.ts` — Revenue, user growth, cohort, funnel analytics (4 endpoints)
  - `swagger/paths/events.ts` — SSE stream and stats (2 endpoints)
  - Updated `swagger/paths/admin.ts` — Added user detail, ban/suspend/activate, unlock account (3 endpoints)
- Added new Swagger tags: "Security", "Real-Time Events"
- Updated `swagger/index.ts` to import and merge all new path modules
- Total documented endpoints: 219

### Previous Session — Backend Feature Implementation
- Security: Refresh Token Rotation, Session Management, Account Lockout, 2FA (TOTP), CSRF Protection
- Admin & Analytics: User management (ban/suspend/unlock), revenue analytics, cohort analysis, payment funnel
- Real-Time: SSE service, push notification service (stub)
- DevOps: Alerting service (webhook-based), error monitoring with digest emails

## Prioritized Backlog

### P1 — Frontend Integration
- 2FA setup and verification flow
- User settings page for session management (view/revoke sessions)
- CSRF token handling for state-changing requests
- Admin dashboard for user management (ban, suspend, unlock)

### P2 — Incident Playbook
- Create `incident-playbook.md` for operational runbook

### P2 — Full Real-Time Features
- Integrate push notification service with FCM
- Expand SSE usage for additional real-time UI updates

### P3 — Integration Testing
- Create dedicated `supertest` integration test files

## Key API Endpoints
- **Auth**: POST /api/user/login, POST /api/user/registerUser
- **2FA**: POST /api/user/2fa/setup, /verify-setup, /validate, /disable, /regenerate-backup-codes, GET /status
- **Sessions**: POST /api/user/refresh-token, GET /api/user/sessions, DELETE /api/user/sessions/:id, GET /api/user/login-history
- **Admin Users**: GET /api/admin/users/:userId, PUT /api/admin/users/:userId/ban, POST /api/admin/users/unlock
- **Analytics**: GET /api/admin/analytics/revenue, /users, /cohorts, /funnel
- **CSRF**: GET /api/csrf-token
- **SSE**: GET /api/events/stream, GET /api/events/stats
- **Swagger Docs**: GET /api/docs, GET /api/docs.json
