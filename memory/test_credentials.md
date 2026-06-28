# Test Credentials

## IMPORTANT — Preview backend DB note (2026-06-27)
- The preview backend's Railway PostgreSQL connected in THIS environment appears to be a fresh/empty DB
  (only test users user_id 2 & 3 exist). The previously documented admin `moxxcompany@gmail.com` does
  NOT exist here — `/api/user/checkEmail` returns `validEmail:false` and `/api/user/login` returns 401.
  Do NOT keep retrying that login (it increments an account-lockout counter).

## Throwaway QA Merchant (created 2026-06-27, verified email)
- Email: qa.onboard.1782585233@dynopaytest.com
- Password: QaOnboard#2026
- user_id: 3 (email_verified=true). Has 1 company: "QA Test Co" (company_id=2). No wallet, no payment link.
- has_password: true

## Empty/new QA Merchant (created 2026-06-28, verified email) — for dashboard empty-state testing
- Email: qa.empty.1782626169@dynopaytest.com
- Password: QaEmpty#2026
- user_id: 8 (email_verified=true). NO company, NO wallet, NO payment link, NO transactions.
- has_password: true

## How to test logged-in flows (login is OTP-gated)
Login is a 2-step flow: `POST /api/user/login` returns `requires_login_otp` + emails an OTP (stored in
Redis `login_otp:<session>`). Automated UI login is therefore not possible without inbox access.
Two options used by the agent:
1. **Token injection (recommended for frontend tests)**: obtain a valid 30-day JWT and inject it:
   - On the app origin: `localStorage.setItem('token', '<JWT>')` then navigate to `/dashboard`.
   - `withAuth` only checks `localStorage.token`; axios auto-attaches it as Bearer.
2. **Scripted login via Redis OTP**: after `POST /api/user/login`, read the OTP with
   Redis key `login_otp:<session>:json` (via ioredis at redis://default:HAEMJseUAdqAjpiICURxlefSoSYXKEUg@nozomi.proxy.rlwy.net:15794),
   then `POST /api/user/verifyLoginOTP`.

## Creating a fresh verified test merchant via API (bot-protection needs a browser User-Agent header)
1. `POST /api/user/registerUser` {name,email,password(>=8, upper/lower/number/special)} → returns `accessToken` + `userData.user_id`.
2. Read OTP from Redis key `email-verify:<user_id>:json`.
3. `POST /api/user/verify-email` {otp} (Bearer accessToken) → email_verified=true.
Header required on all calls: `User-Agent: Mozilla/5.0 ... Chrome/120 Safari/537.36`

## Notes
- Admin passwords use bcrypt (12 rounds) with transparent SHA-256 migration on first login.
- JWT access tokens expire after 30 days.
- OTP rate limiter: 10 requests per IP:contact combo per 15 minutes.
