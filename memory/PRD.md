# DynoPay - Crypto Payment Gateway PRD

## Original Problem Statement
Crypto payment processing system requiring:
1. Bug fixes (double withdrawal fee, deposit_tx_hash population)
2. Auto-conversion flow optimization
3. Fee structure refactoring (1.5% + $1.00 tier-based fixed fee)
4. Professional email template redesign
5. Consistent gas fee deduction across all chains
6. Reliable automated sweep mechanism (eliminate "ghost transaction" bugs)
7. Instant sweep trigger for auto-conversion payments

## Core Architecture
- **Backend**: Node.js / TypeScript
- **Database**: PostgreSQL (Sequelize ORM)
- **Proxy**: SSH SOCKS5 Tunneling with autossh (for Binance)
- **3rd Party APIs**: Binance (conversion), Tatum (webhooks/gas estimation), Brevo (email)
- **Blockchain**: ethers.js v6 (direct EVM transfers), Tatum SDK (non-EVM chains)

## What's Been Implemented

### Session 1-3: Core Fixes
- Double withdrawal fee bug fixed and verified
- Auto-conversion speed optimized (~8min faster)
- Fee structure refactored: 1.5% + $1.00 tier-based fixed fee
- Buffer logic removed from codebase

### Session 4: Email Template Redesign
- Created shared email template system (`utils/emailTemplate.ts`)
- Updated all 30+ templates in `services/emailService.ts` and `helper/sendEmail.ts`
- Added email preview gallery at `/api/diagnostics/email-preview`

### Session 5 (Current - Feb 13, 2026): Ghost TX Fix & Instant Sweep

#### P1: Ghost Transaction Bug Fix (COMPLETE)
- **Created** `services/merchantPool/directEvmTransfer.ts` — direct ethers.js-based EVM transfer module
  - Builds, signs, and broadcasts transactions locally via JSON-RPC
  - TX hash is deterministic (computed from signed bytes) — eliminates ghost TXs entirely
  - Multi-RPC fallback (Tatum primary, public RPC fallback)
  - Supports: ETH, USDT-ERC20, USDC-ERC20, RLUSD-ERC20, POLYGON, USDT-POLYGON
  - Non-retryable error detection (insufficient funds, nonce too low)
  - Gas price cap to prevent overpaying during fee spikes
- **Modified** `services/merchantPool/merchantPoolSweep.ts`
  - `sweepPoolAddress()` now uses `directEvmSweep()` for EVM chains
  - Non-EVM chains (TRX, XRP, BTC, LTC, DOGE, BCH) still use Tatum SDK path
  - Retry logic preserved for both paths
  - Post-broadcast confirmation check retained as safety net
- **Unit tests**: 19/19 passed (`tests/test_direct_evm_transfer.ts`)

#### P2: Instant Sweep for Auto-Convert (COMPLETE)
- **Fixed** token chain status bug in `controller/paymentController.ts`
  - `releaseAddress()` sets token chains to AVAILABLE, but `sweepPoolAddress()` requires IN_USE
  - Added status transition to IN_USE before triggering instant sweep for token chains
- **Added** 15-second delay before instant sweep to allow incoming TX block confirmation
  - ETH block time ~12s, Polygon ~2s — 15s provides safe margin
- Auto-convert payments now sweep immediately after block confirmation (no more waiting for 2-min cron)

## Pending Tasks

### P0: Verify deposit_tx_hash Fix (TESTING PENDING)
- Code fix in `services/addressService.ts` needs end-to-end verification
- Requires live blockchain transaction to test

### P1: Implement Consistent Gas Fee Deduction (NOT STARTED)
- Native/Token chains currently have platform paying gas
- Must modify `paymentController.ts` to deduct gas from merchant payout

## Future/Backlog
- Corrective ETH transfer script (`scripts/corrective_transfer.ts`) ready to execute when needed
- Refactor monolithic `paymentController.ts`
- ✅ COMPLETED: Create persistent `autossh` tunnel service for Binance proxy (Feb 13, 2026)
- Pre-existing TS error in `paymentController.ts` line 1115

## Recent Updates (Feb 13, 2026)

### Binance Proxy - OPERATIONAL ✅
- Installed sshpass and autossh packages
- Created persistent SOCKS5 tunnel to German VPS (95.179.167.16)
- Configured supervisor service for auto-start and auto-reconnect
- Binance WebSocket now connected and streaming live prices
- Auto-conversion service fully operational
- See `/app/BINANCE_PROXY_SETUP.md` for complete documentation

## Key Files
- `services/merchantPool/directEvmTransfer.ts` - Direct EVM sweep via ethers.js (NEW)
- `services/merchantPool/merchantPoolSweep.ts` - Sweep logic (MODIFIED for P1)
- `controller/paymentController.ts` - Auto-convert instant sweep (MODIFIED for P2)
- `tests/test_direct_evm_transfer.ts` - Unit tests for direct EVM transfer
- `utils/emailTemplate.ts` - Shared email base template
- `services/emailService.ts` - Email templates
- `scripts/corrective_transfer.ts` - Manual corrective transfer script

## Test Credentials
- User: richard@dyno.pt / Katiekendra123@
- VPS: 95.179.167.16 root / E9o,RRotPdX_d7fC
