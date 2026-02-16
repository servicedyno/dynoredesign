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
- Two-Factor Authentication (2FA/TOTP) with backup codes — FIXED: validate returns JWT + session
- Refresh Token Rotation
- Session Management (list, revoke, login history)
- Account Lockout (Redis-based, with admin unlock)
- CSRF Protection (Double Submit Cookie pattern)
- Rate Limiting (per-IP, per-email, per-endpoint)
- Input Sanitization (XSS prevention)
- Input Validation (Joi-based middleware on login, register, 2FA, password reset endpoints)
- Webhook HMAC signature verification
- Centralized Error Handler (global catch-all + malformed JSON → 400)

## Real-Time Features (Implemented)
- SSE Service: Full Server-Sent Events with multi-channel support
- Push Notification Service: Unified notification delivery via SSE + DB persistence
- Admin Broadcast: System-wide announcements to all connected clients
- Admin Push: Targeted notification delivery to specific users
- Alert Service: Slack/Discord webhook alerts with deduplication and retry

## SSH Tunnel & Binance Connectivity (Fixed Feb 2026)
- **SSH SOCKS5 Tunnel**: Auto-starts on boot, health checks every 30s, auto-reconnect with exponential backoff
- **Smart Proxy Detection**: Tests direct access first, falls back to proxy only when geo-blocked (US servers)
- **WebSocket Auto-Reconnect**: When proxy state changes (tunnel up/down), WS reconnects with correct proxy settings
- **Startup Sequence**: Tunnel starts → waits 6s → detects Binance access → starts WebSocket with correct proxy
- **Admin Status**: GET /api/admin/tunnel/status returns tunnel, proxy, and WS status
- **Resilience**: Survives server restarts — tunnel + proxy + WS all auto-recover

## Key API Endpoints
- **Auth**: POST /api/user/login, POST /api/user/registerUser
- **2FA**: POST /api/user/2fa/setup, /verify-setup, /validate (returns JWT), /disable, /regenerate-backup-codes, GET /status
- **Sessions**: POST /api/user/refresh-token, GET /api/user/sessions, DELETE /api/user/sessions/:id
- **Admin**: GET /api/admin/getAllUsers, POST /api/admin/login, GET /api/admin/tunnel/status
- **CSRF**: GET /api/csrf-token
- **SSE**: GET /api/events/stream, GET /api/events/stats
- **Diagnostics**: GET /diagnostics/binance-proxy, POST /diagnostics/binance-proxy
- **Swagger Docs**: GET /api/docs, GET /api/docs.json (225 paths)

## Code Audit Fixes (Completed Feb 2026)
- P0: 2FA login flow — FIXED (returns JWT + session)
- P1: CSRF Protection — VERIFIED
- P1: Centralized Error Handling — VERIFIED
- P2: Hardcoded Config — FIXED (env vars)
- P2: Swagger Docs — UPDATED
- P3: Input Validation — IMPLEMENTED (Joi middleware)

## SSH/Binance Fixes (Completed Feb 2026)
- Installed sshpass (was missing, preventing tunnel from starting)
- Fixed startup race condition (6s delay before proxy detection)
- Added proxy state change callback to trigger WS reconnect
- Added GET /api/admin/tunnel/status endpoint
- Verified auto-recovery after server restart

## Integration Test Suite
All tests in `backend/__tests__/api/`:
- `authFlows.test.ts`, `adminFlows.test.ts`, `coreServices.test.ts`, `paymentWalletFlows.test.ts`, `realTimeEvents.test.ts`
- **Test Results**: 62/62 passing

## Prioritized Backlog

### P1 — Frontend Integration
- 2FA setup and verification flow
- User settings page for session management
- Admin dashboard for user management
- Real-time notification UI

### P2 — Advanced Features
- Firebase Cloud Messaging (FCM) for mobile push notifications
- Email notification delivery channel
- Webhook retry dashboard UI

## Admin Credentials
- Email: moxxcompany@gmail.com
- Password: Katiekendra123@
