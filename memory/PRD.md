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

### Session 2 (Current - Feb 13, 2026)
- **ROOT CAUSE IDENTIFIED**: Tatum SDK's `ethBlockchainTransfer` was computing TX hashes locally but never broadcasting to the Ethereum network (ghost TXs)
- **FIX APPLIED**: Switched EVM chain sweeps (ETH, POLYGON) to use `directEvmSweep` (ethers.js + `eth_sendRawTransaction` via public RPCs), bypassing Tatum SDK entirely
- **Lock TTL fix**: Increased cron lock TTL from 50s to 180s to prevent lock contention
- **Removed blocking confirmation check**: Previous agent's `waitForTransactionConfirmation` was causing permanent SWEEPING state
- **Verified on-chain**: TX `0xae99e2...` confirmed in block 24449830, 0.005102 ETH swept successfully

## Key Files Modified
- `backend/services/merchantPool/merchantPoolSweep.ts` — Sweep logic now routes EVM chains through `directEvmSweep`
- `backend/server.ts` — Lock TTL increased from 50s to 180s

## Key Technical Decisions
- EVM chains: ethers.js direct RPC (LlamaRPC → publicnode → Tatum as fallback)
- Non-EVM chains (TRX, XRP, BTC, etc.): Continue using Tatum SDK (proven reliable)

## Session 2 - Binance Proxy & E2E Verification (Feb 13, 2026)
- Re-established SOCKS5 proxy tunnel to German VPS (95.179.167.16) via sshpass+ssh
- Added supervisor-managed `binance-proxy` service for persistence across restarts
- Binance geo-block detection working: auto-detects 451 → enables proxy
- BinanceWS connected, tracking 10 assets; stablecoin conversion cron running
- **E2E conversion verified**: Conversion #8 completed — sweep → Binance deposit → ETH→USDT conversion → USDT withdrawal to merchant ($9.48 payout)

## Known Minor Issues
- Payout email fails with `column User.id does not exist` — non-blocking, email-only issue
- Conversion records 3-7 remain FAILED (from ghost TX era) — would need new payments to resolve

## Backlog
- P1: Consolidate redundant sweep logic (clean up dead Tatum SDK EVM paths)
- P2: Fix payout email User.id column issue
- P2: Monitor sweep reliability over time
