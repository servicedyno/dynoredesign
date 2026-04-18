# DynoPay - Payment Gateway PRD

## Problem Statement
USDT-TRC20 payment was received but never forwarded to the merchant. The root cause was a TRON `OUT_OF_ENERGY` transaction failure that was incorrectly marked as successful (`payout_complete`) because the system didn't check the transaction's `contractResult`.

## What's Been Implemented

### 2026-04-18 — DB Migration from Railway → DigitalOcean Managed PostgreSQL
- **Trigger**: Railway PostgreSQL instance was lost
- **New DB**: DigitalOcean Managed PostgreSQL in FRA1 region
  - Host: `db-postgresql-fra1-93644-do-user-19053663-0.k.db.ondigitalocean.com:25060`
  - Database: `dynopay`, User: `doadmin`, SSL required
- **Schema**: All 40 tables recreated via per-model sync script (`database/migrate_per_model.ts`) — handles FK forward-refs via multi-pass sync
- **Admin user**: `tbl_admin` reseeded with `moxxcompany@gmail.com` (bcrypt hashed)
- **Code changes**:
  - `utils/dbInstance.ts`: Now auto-enables SSL for non-localhost HOST in individual-var connection path (DigitalOcean requires SSL)
  - `backend/.env`: Updated DB_NAME / USER_NAME / PASSWORD / HOST / DB_PORT
- **Railway production**: Same 6 DB vars pushed to `DynoRedesign` service (project `c23ac3d9-…`, env `production`) via Railway GraphQL API

### 2026-04-18 — Deployed to Render with Docker + Custom Domains + DO Valkey
- **New Render service**: `dynopay` (`srv-d7hrdsosfn5c73ed5v60`), Docker runtime, Starter plan, Frankfurt region
- **Built from**: `servicedyno/DynoRedesign` repo, `main` branch, using existing multi-stage `Dockerfile` + nginx + `start-all.sh`
- **Env vars**: 147 vars synced from `/app/backend/.env` + prod URL overrides (SERVER_URL, CHECKOUT_URL, FRONTEND_URL, NEXTAUTH_URL/SECRET, NEXT_PUBLIC_*) via `PUT /env-vars`
- **DO Valkey**: Redis migrated from local to DigitalOcean Managed Valkey (`rediss://…:25061`, TLS). `webhookQueue.ts` `parseRedisUrl()` updated to detect `rediss://` and enable TLS for BullMQ/ioredis
- **Custom domains attached**: `api.dynopay.com`, `checkout.dynopay.com`, `dynopay.com`, `www.dynopay.com` (pending DNS verification)
- **Live URL (pre-DNS)**: https://dynopay.onrender.com — `/health` returns `database=connected, redis=connected, tatum=operational, binance_websocket=connected`, admin login returns JWT ✅
- **Old service**: `DynoRedesign` (Node buildpack, free tier) DELETED
- **Custom domains verified & LIVE** (2026-04-18):
  - `https://api.dynopay.com` — backend API (`/health` returns healthy, admin login works)
  - `https://checkout.dynopay.com` — checkout page (HTTP 200)
  - `https://dynopay.com` — main frontend (HTTP 200, 172KB landing page)
  - `https://www.dynopay.com` — 301 redirect → apex
- **Cloudflare DNS updated** via API (zone `7dff9c723838c34337b6f8aa54aef88e`):
  - `api.dynopay.com` CNAME → `dynopay.onrender.com` (DNS-only)
  - `checkout.dynopay.com` CNAME → `dynopay.onrender.com` (DNS-only, was proxied)
  - `dynopay.com` apex CNAME → `dynopay.onrender.com` (DNS-only, CNAME flattening) — *NOTE: A record to 216.24.57.1 was tried first but Cloudflare error 1011 "prohibited IP" blocked it because the IP is in Cloudflare's range; CNAME flattening bypasses this since it resolves to non-blocked Render CDN IPs (216.24.57.251 / 216.24.57.7)*
  - `www.dynopay.com` CNAME → `dynopay.onrender.com` (DNS-only, newly created)
  - Old `_railway-verify` TXT records cleaned up
- All SSL certs auto-provisioned by Render via Let's Encrypt

### 2026-03-25 — Critical Bug Fix: Double SUN→TRX Conversion (Fee Wallet Drain)
- **Root Cause**: `tatumApi.getAddressBalance()` was fixed on ~March 15 to convert SUN→TRX (÷1M), but 4 caller sites still had their own ÷1M, making TRX balances appear 1,000,000× smaller
- **Impact**: `fundGasIfNeeded` always thought pool addresses had 0 gas → kept draining the fee wallet. `checkFeeBalance` reported $0 instead of actual ~$21 balance
- **Fix**: Removed extra `/1000000` in `merchantPoolSweep.ts`, `paymentController.ts` (×2), `adminController.ts`
- **On-chain proof**: Fee wallet had 69.4 TRX (~$21) but code reported 0.000069 TRX (~$0)

### 2026-03-23 — Auto-Convert Icon Fix
- Fixed auto-convert icon visibility in `TransactionsTable.tsx` and `TransactionDetailsModal.tsx`
- Updated references from legacy `"done"` status to `"settled"` to match the refactored status system

### 2026-03-01 — Critical Bug Fix & Fund Recovery
1. **Bug Fix (tatumApi.ts):** `waitForTransactionConfirmation` now validates `ret[0].contractRet === 'SUCCESS'` for TRON transactions
2. **Retry Logic (paymentController.ts):** Settlement retries on TRON execution errors like `OUT_OF_ENERGY`
3. **Recovery Endpoint (diagnosticsRouter.ts):** Rewrote `/diagnostics/recover-stuck-payment` to use correct data models
4. **Fund Recovery Executed:** Successfully recovered 98.7577 USDT from stuck payment
5. **Data Consistency Fix (paymentController.ts):** `recordPoolTransaction` now stores actual post-gas `sendAmount`

### Previous Session — Comprehensive Bug Fixing
- 13+ bugs fixed: registration validation, payment link creation, wallet management
- Auto API key creation on onboarding
- TRON `OUT_OF_ENERGY` fix and stuck payment recovery
- Gas drain fix with funding cap
- Webhook & status refactoring (`payment.confirmed` / `payment.settled`)
- Frontend status system: `pending`, `confirmed`, `processing`, `settled`, `failed`

## Prioritized Backlog

### P1 — Upcoming
- **TRX Hot Wallet:** ~~Investigate why gas wallet depletes, add monitoring/alerts~~ FIXED (2026-04-02): FeeWalletMonitor now checks the correct DB wallet
- **Merchant Webhook 404:** Debug and fix failing webhook at `lockbaypaymentfixing-production.up.railway.app/webhook/dynopay`

### P2 — Future
- Low gas balance alerting (Slack/email)
- Improved webhook retry logic and dead letter queue
- Admin dashboard for stuck payment visibility
- Refactoring of `paymentController.ts` (8,500+ lines) into smaller services
