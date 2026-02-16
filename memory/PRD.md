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
- Two-Factor Authentication (2FA/TOTP) with backup codes
- Refresh Token Rotation
- Session Management (list, revoke, login history)
- Account Lockout (Redis-based, with admin unlock)
- CSRF Protection (Double Submit Cookie pattern)
- Rate Limiting (per-IP, per-email, per-endpoint)
- Input Sanitization (XSS prevention)
- Webhook HMAC signature verification

## Real-Time Features (Implemented)
- **SSE Service**: Full Server-Sent Events with multi-channel support (payments, prices, notifications, admin, dashboard)
- **Push Notification Service**: Unified notification delivery via SSE + DB persistence
- **Admin Broadcast**: System-wide announcements to all connected clients
- **Admin Push**: Targeted notification delivery to specific users
- **Admin Monitoring Events**: Custom events to admin channel subscribers
- **Alert Service**: Slack/Discord webhook alerts with deduplication and retry

## Incident Response
- **Incident Playbook**: `/incident-playbook.md` — operational runbook covering SEV-1 through SEV-4 incidents
- **Diagnostics**: `/diagnostics/error-monitor`, `/diagnostics/webhook-queue`, `/diagnostics/volatility`

## Key API Endpoints
- **Auth**: POST /api/user/login, POST /api/user/registerUser
- **2FA**: POST /api/user/2fa/setup, /verify-setup, /validate, /disable, /regenerate-backup-codes, GET /status
- **Sessions**: POST /api/user/refresh-token, GET /api/user/sessions, DELETE /api/user/sessions/:id, GET /api/user/login-history
- **Admin Users**: GET /api/admin/users/:userId, PUT /api/admin/users/:userId/ban, POST /api/admin/users/unlock
- **Admin Alerts**: GET /api/admin/alerts/health, POST /api/admin/alerts/test
- **Analytics**: GET /api/admin/analytics/revenue, /users, /cohorts, /funnel
- **CSRF**: GET /api/csrf-token
- **SSE**: GET /api/events/stream, GET /api/events/stats, GET /api/events/push-stats
- **Real-Time Admin**: POST /api/events/broadcast, POST /api/events/push, POST /api/events/admin-event
- **Swagger Docs**: GET /api/docs, GET /api/docs.json

## Integration Test Suite
All tests in `backend/__tests__/api/`:
- `authFlows.test.ts` — Registration, login, token refresh, sessions, 2FA status
- `adminFlows.test.ts` — Admin login, user management, alert service, analytics
- `coreServices.test.ts` — Health, status, CSRF, SSE stats, Swagger docs
- `paymentWalletFlows.test.ts` — Payment/wallet auth guards, company, dashboard
- `realTimeEvents.test.ts` — Push stats, broadcast, push notification, admin events

Run: `cd /app/backend && npx jest --config jest.config.ts --selectProjects integration --forceExit`

## Prioritized Backlog

### P1 — Frontend Integration
- 2FA setup and verification flow
- User settings page for session management (view/revoke sessions)
- CSRF token handling for state-changing requests
- Admin dashboard for user management (ban, suspend, unlock)
- Real-time notification UI (consuming SSE events)

### P2 — Advanced Features
- Firebase Cloud Messaging (FCM) for mobile push notifications
- Email notification delivery channel in push notification service
- Dashboard live data channel (transaction count updates, revenue tickers)
- Webhook retry dashboard UI

## Admin Credentials
- Email: moxxcompany@gmail.com
- Password: Katiekendra123@
