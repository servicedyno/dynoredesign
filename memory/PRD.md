# DynoPay - Product Requirements Document

## Overview
DynoPay is a crypto payment gateway that enables merchants to accept cryptocurrency payments with ease. It provides a comprehensive API for payment processing, wallet management, and business analytics.

## Tech Stack
- **Backend**: Node.js/TypeScript (Express) — proxied through Python/uvicorn for Kubernetes compatibility
- **Database**: PostgreSQL (Sequelize ORM) + Redis (caching, rate limiting, locks)
- **Frontend**: React
- **Infrastructure**: Kubernetes, Railway deployment support
- **Testing**: Jest + Supertest (integration tests in `__tests__/api/`)

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
- Two-Factor Authentication (2FA/TOTP) with backup codes — **FIXED: validate endpoint now returns JWT + session**
- Refresh Token Rotation
- Session Management (list, revoke, login history)
- Account Lockout (Redis-based, with admin unlock)
- CSRF Protection (Double Submit Cookie pattern)
- Rate Limiting (per-IP, per-email, per-endpoint)
- Input Sanitization (XSS prevention)
- **Input Validation** (Joi-based middleware on login, register, 2FA, password reset endpoints)
- Webhook HMAC signature verification
- Centralized Error Handler (global catch-all + malformed JSON → 400)

## Real-Time Features (Implemented)
- **SSE Service**: Full Server-Sent Events with multi-channel support
- **Push Notification Service**: Unified notification delivery via SSE + DB persistence
- **Admin Broadcast**: System-wide announcements to all connected clients
- **Admin Push**: Targeted notification delivery to specific users
- **Alert Service**: Slack/Discord webhook alerts with deduplication and retry

## Key API Endpoints
- **Auth**: POST /api/user/login, POST /api/user/registerUser
- **2FA**: POST /api/user/2fa/setup, /verify-setup, /validate (returns JWT), /disable, /regenerate-backup-codes, GET /status
- **Sessions**: POST /api/user/refresh-token, GET /api/user/sessions, DELETE /api/user/sessions/:id
- **Admin**: GET /api/admin/getAllUsers, POST /api/admin/login
- **CSRF**: GET /api/csrf-token
- **SSE**: GET /api/events/stream, GET /api/events/stats
- **Swagger Docs**: GET /api/docs, GET /api/docs.json (225 paths)

## Code Audit Fixes (Completed Feb 2026)

### P0: 2FA Login Flow — FIXED
- `controller/twoFactorController.ts` — validateEndpoint now creates session and returns JWT accessToken, refreshToken, session_id, userData

### P1: CSRF Protection — VERIFIED
- `middleware/csrfMiddleware.ts` — Double Submit Cookie pattern already implemented
- Integrated in `server.ts` with cookie-parser

### P1: Centralized Error Handling — VERIFIED
- Global error handler in `server.ts` (lines 879-894)
- Body parser error handler catches malformed JSON → returns 400

### P2: Hardcoded Config — FIXED
- `services/twoFactorService.ts` — BACKUP_CODE_COUNT, MAX_2FA_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES now use env vars

### P2: Swagger Docs — UPDATED
- `swagger/paths/security.ts` — 2FA validate response updated to show JWT + session fields

### P3: Input Validation — IMPLEMENTED
- `middleware/validateRequest.ts` — Joi validation middleware
- Applied to: login, registerUser, forgot-password, reset-password, changePassword, 2fa/validate

## Integration Test Suite
All tests in `backend/__tests__/api/`:
- `authFlows.test.ts` — Registration, login, token refresh, sessions, 2FA status
- `adminFlows.test.ts` — Admin login, user management, alert service, analytics
- `coreServices.test.ts` — Health, status, CSRF, SSE stats, Swagger docs
- `paymentWalletFlows.test.ts` — Payment/wallet auth guards, company, dashboard
- `realTimeEvents.test.ts` — Push stats, broadcast, push notification, admin events

Run: `cd /app/backend && npx jest --config jest.config.ts --selectProjects integration --forceExit`

**Test Results**: 62/62 passing + 18/18 P0-P3 feature tests

## Prioritized Backlog

### P1 — Frontend Integration
- 2FA setup and verification flow
- User settings page for session management
- CSRF token handling for state-changing requests
- Admin dashboard for user management
- Real-time notification UI (consuming SSE events)

### P2 — Advanced Features
- Firebase Cloud Messaging (FCM) for mobile push notifications
- Email notification delivery channel
- Dashboard live data channel
- Webhook retry dashboard UI

## Admin Credentials
- Email: moxxcompany@gmail.com
- Password: Katiekendra123@
