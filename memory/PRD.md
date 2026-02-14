# DynoPay - Crypto Payment Gateway

## Original Problem Statement
Full-stack crypto payment gateway (Node.js/TypeScript backend, React frontend, PostgreSQL). User reported critical bug: ETH payment sweep ("auto-sweep to Binance for auto conversion") was failing with "ghost transactions" — Tatum SDK returned TX hashes that never appeared on the Ethereum blockchain.

## Architecture
- **Backend**: Node.js, TypeScript, Fastify, Sequelize
- **Frontend**: React (separate repo — this repo's frontend is a placeholder)
- **Database**: PostgreSQL
- **Cache**: Redis (Railway hosted)
- **Integrations**: Tatum (blockchain), Binance (crypto conversion), Brevo (emails)
- **Infrastructure**: Supervisor-managed services, SOCKS5 proxy for Binance API

## What's Been Implemented

### Session 1 (Previous Agent)
- Repository setup, dependency installation
- Binance SOCKS5 proxy configuration via autossh
- Test payment creation ($10 ETH via merchant API)
- Multiple failed attempts to fix sweep (Tatum SDK, state management, DB model fixes)

### Session 2 (Feb 13, 2026)
- **ROOT CAUSE IDENTIFIED**: Tatum SDK's `ethBlockchainTransfer` was computing TX hashes locally but never broadcasting to the Ethereum network (ghost TXs)
- **FIX APPLIED**: Switched EVM chain sweeps (ETH, POLYGON) to use `directEvmSweep` (ethers.js + `eth_sendRawTransaction` via public RPCs), bypassing Tatum SDK entirely
- **Lock TTL fix**: Increased cron lock TTL from 50s to 180s to prevent lock contention
- **E2E conversion verified**: Conversion #8 & #9 completed — sweep → Binance deposit → ETH→USDT conversion → USDT withdrawal to merchant
- **Payout email bug fixed**: Corrected column name (user_id instead of id) in emails.ts DB query

### Session 3 (Feb 14, 2026)
- **Binance proxy persistence fix**: Installed `sshpass` (missing in forked env), fixed supervisor config, removed broken `binance-tunnel` (required unavailable `autossh`)
- **Proxy detection retry**: Made `detectBinanceAccess()` retry-able — if proxy was down at startup but tunnel comes up later, next cron cycle re-detects and enables it
- **Conversion cron proxy re-detection**: When Binance appears unreachable, conversion service now re-runs `detectBinanceAccess()` before giving up
- **Cron interval reduced**: 2 min → 1 min for faster deposit/withdrawal detection
- **Adaptive fast-polling**: When active PENDING_DEPOSIT/WITHDRAWING records exist, auto-schedules 30s re-check
- **Withdrawal completion logging fixed**: Added DEBUG logs for monitoring, proper counter tracking
- **Full fee breakdown in payout email**: Platform fee (1.5%), sweep gas fee, exchange fee (0.1%), Binance withdrawal fee, net payout
- **Fee tracking in conversion records**: `conversion_fee` (platform fee USD), `sweep_fee_usd` (gas cost in USD), calculated using actual conversion rate at trade time
- **E2E verified**: Conversion #11 completed successfully — full pipeline from fund detection to merchant payout ($9.41 USDT)

### Session 4 (Feb 14, 2026)
- **(P0) Consolidated EVM sweep logic**: Gas funding for EVM chains (ETH, POLYGON) now uses `directEvmSweep` instead of Tatum SDK. All EVM branches in `tatumApi.ts:assetToOtherAddress` have deprecation warnings for sweep usage.
- **(P1) Real-time conversion status tracker API**: Two new endpoints added to `dashboardRouter`:
  - `GET /api/dashboard/conversions` — List conversions with `pipeline_stage` field, status filter, status summary counts
  - `GET /api/dashboard/conversions/:id` — Single conversion detail with timeline (Detected → Sweeping → Depositing → Converting → Withdrawing → Complete), fee breakdown, error info
- **Pipeline stages enum** returned in list response for frontend rendering reference

## Key API Endpoints

### Conversion Status Tracker (NEW)
- `GET /api/dashboard/conversions?status=COMPLETED&company_id=38&limit=20` — List with optional filters
  - **Multi-tenant**: `company_id` validated against user ownership; `company_name` joined in response
  - Returns: `{ conversions: [..., pipeline_stage, company_name], count, status_summary, pipeline_stages }`
- `GET /api/dashboard/conversions/:id?company_id=38` — Detailed view with timeline & fees
  - **Multi-tenant**: `company_id` ownership check; scopes to user's companies only
  - Returns: `{ conversion (with company_name), timeline: [{stage, label, timestamp, completed, active}], fee_breakdown, is_failed, is_complete }`
- **Pipeline stages**: `DETECTED → SWEEPING → DEPOSITING → CONVERTING → WITHDRAWING → COMPLETE`
- **Auth**: Bearer token required (from `POST /api/user/login`)

### Existing
- `POST /api/company/direct_crypto_payment` — Create new payment request
- `GET /api/dashboard` — Dashboard stats
- `GET /api/dashboard/chart-data` — Chart data
- `GET /api/dashboard/recent-transactions` — Recent transactions

## Key Files Modified (Session 4)
- `backend/controller/dashboardController.ts` — Added `getConversions` and `getConversionDetail` handlers
- `backend/routes/dashboardRouter.ts` — Added `/conversions` and `/conversions/:id` routes
- `backend/services/merchantPool/merchantPoolSweep.ts` — Gas funding now uses `directEvmSweep` for EVM chains
- `backend/apis/tatumApi.ts` — Deprecation warnings on EVM branches of `assetToOtherAddress`

## Credentials
- **User**: richard@dyno.pt / Katiekendra123@
- **SSH Proxy**: root@95.179.167.16 (password in supervisor config)

## Backlog
- P2: Monitor sweep reliability over time
- P2: Broader integration testing of full pipeline
- P2: Additional monitoring/alerting for proxy health
