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

## Backlog
- P1: Consolidate redundant sweep logic (clean up dead Tatum SDK EVM paths)
- P2: Binance WebSocket 451 error (geo-blocking, needs proxy investigation)
- P2: Monitor sweep reliability over time
