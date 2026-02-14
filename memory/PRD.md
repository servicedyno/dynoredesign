# DynoPay - Crypto Payment Gateway

## Original Problem Statement
Full-stack crypto payment gateway (Node.js/TypeScript backend, React frontend, PostgreSQL). User reported critical bug: ETH payment sweep ("auto-sweep to Binance for auto conversion") was failing with "ghost transactions" — Tatum SDK returned TX hashes that never appeared on the Ethereum blockchain.

## Architecture
- **Backend**: Node.js, TypeScript, Fastify, Sequelize
- **Frontend**: React
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

## Key Files Modified
- `backend/services/conversionService.ts` — Fee tracking, adaptive polling, proxy re-detection, completion logging
- `backend/services/binanceService.ts` — Retry-able proxy detection
- `backend/helper/sendEmail.ts` — Detailed fee breakdown in payout email
- `backend/controller/paymentController.ts` — Pass platform fee data to conversion record
- `backend/services/merchantPool/merchantPoolSweep.ts` — Sweep logic (EVM → directEvmSweep)
- `backend/server.ts` — Lock TTL, cron scheduling
- `/etc/supervisor/conf.d/binance-proxy.conf` — Persistent SSH tunnel

## Key Technical Decisions
- EVM chains: ethers.js direct RPC (LlamaRPC → publicnode → Tatum as fallback)
- Non-EVM chains (TRX, XRP, BTC, etc.): Continue using Tatum SDK (proven reliable)
- Binance proxy: `sshpass + ssh -D 1080` via supervisor (autorestart=true, startretries=999)
- Fee calculation: Platform fee deducted in crypto before conversion, converted to USD using actual trade rate

## Fee Flow
1. Customer pays ETH to temp wallet
2. Platform fee (1.5% + fixed) deducted in crypto → `adminAmountToSend`
3. Merchant amount → `originalUserAmount` (= `source_amount` in conversion)
4. ALL crypto swept to admin wallet (Binance deposit address)
5. Gas fee for sweep deducted from swept amount
6. Only merchant portion converted to USDT on Binance
7. USDT withdrawn to merchant settlement wallet
8. Binance withdrawal fee deducted (0 for off-chain, ~1 USDT for on-chain TRC20)

## Credentials
- **User**: richard@dyno.pt / Katiekendra123@
- **SSH Proxy**: root@95.179.167.16 (password in supervisor config)

## Backlog
- P1: Consolidate redundant sweep logic (clean up dead Tatum SDK EVM paths in tatumApi.ts)
- P2: Monitor sweep reliability over time
- P2: Add dashboard visibility for conversion fee breakdown
