# DynoPay - Crypto Payment Gateway PRD

## Original Problem Statement
Full-stack cryptocurrency payment gateway (DynoPay) with Node.js/TypeScript backend, React frontend, PostgreSQL + Redis databases. Integrated with Tatum (crypto ops), Binance (currency conversion), and Brevo (transactional emails). Deployed on Railway.

## Architecture
- **Backend**: Node.js/TypeScript + Express, running on Railway (port 3300)
- **Frontend**: React.js
- **Database**: PostgreSQL (Sequelize ORM) + Redis (caching/locks)
- **Emergent Pod**: Python/uvicorn proxy on 8001 -> Node.js on 3300
- **3rd Party**: Tatum, Binance, Brevo (Sendinblue), Blockstream, Blocknative
- **Production URL**: https://api.dynopay.com

## What's Been Implemented

### Sessions 1-5 (Feb 12, 2026)
- Full codebase analysis, security audit, security improvements
- Fixed broken email logo, Binance Convert API -> Spot Market Orders
- Adaptive Conversion System (volatility monitor, fee rate service, Limit IOC)
- Live testing: POL sale verified on Binance
- Auto-conversion payout email template

### Session 10 (Feb 12, 2026)
- Auto-Convert wallet selection flow improvements
- Brevo fix + error logging consolidation

### Session 11 (Feb 12-13, 2026) - Proxy & Auto-Conversion Debugging
- SOCKS5 proxy tunnel to German VPS for Binance connectivity
- Fixed notification logic (merchant emails showing correct amounts)
- Permissive Tatum webhook validation middleware
- Removed double withdrawal fee deduction in binanceService.ts
- Reworked deposit_tx_hash auto-population in merchantPoolSweep.ts
- Two end-to-end test payments completed successfully

### Session 12 (Feb 13, 2026) - Auto-Convert Pipeline Speed Optimization
- **Immediate sweep trigger**: `paymentController.ts` fires `sweepPoolAddress()` right after address release for auto-convert payments (fire-and-forget). Applies to ALL volatile currencies.
- **Conversion cron interval**: Reduced from 5 min → 2 min (`BINANCE_CONVERT_INTERVAL_MINUTES=2`)
- **Sweep fallback timers**: All volatile native chains (TRX, ETH, SOL, XRP, POLYGON) reduced from `time:3` → `time:1`. Stablecoin configs untouched.
- Expected improvement: Pipeline from ~15-20 min → ~4-7 min (dominated by Binance deposit confirmation)

## Volatile Currencies (subject to auto-conversion)
BTC, ETH, LTC, DOGE, TRX, BCH, SOL, XRP, POLYGON

## Stablecoin Currencies (no conversion needed)
USDT, USDC, RLUSD, USDT-TRC20, USDT-ERC20, USDC-ERC20, USDT-POLYGON, RLUSD-ERC20

## Key Environment Config
- `BINANCE_CONVERT_INTERVAL_MINUTES=2` (conversion cron)
- `ETH_SWEEP=time:1`, `TRX_SWEEP=time:1`, `SOL_SWEEP=time:1`, `XRP_SWEEP=time:1`, `POLYGON_SWEEP=time:1`
- `BINANCE_PROXY_URL=socks5://127.0.0.1:1080`

## Prioritized Backlog

### P0 - Needs Verification
- [ ] Run live auto-convert test to verify immediate sweep works end-to-end
- [ ] Verify deposit_tx_hash auto-population on clean (non-patched) test

### P1 - Next
- [ ] Create persistent autossh tunnel (current tunnel is manual, dies on restart)
- [ ] Deploy all changes to Railway production

### P2 - Future
- [ ] Refactor monolithic paymentController.ts (~4600 lines)
- [ ] Refactor addressService.ts sweep logic
- [ ] Migrate email logo to permanent CDN

## Key Files
- `backend/controller/paymentController.ts` - Payment flow + auto-convert + immediate sweep trigger
- `backend/services/conversionService.ts` - Conversion pipeline (4 phases)
- `backend/services/binanceService.ts` - Spot trading, withdrawal, Binance API
- `backend/services/merchantPool/merchantPoolSweep.ts` - Sweep logic + deposit_tx_hash update
- `backend/services/merchantPool/merchantPoolConfig.ts` - Sweep config parsing
- `backend/server.ts` - Cron jobs + route registration
- `backend/middleware/validateTatum.ts` - Webhook auth (permissive mode)

## Key Diagnostic Endpoints
- `GET /api/diagnostics/binance-balances` - Non-zero Binance balances
- `GET /api/diagnostics/binance-quote` - Spot quote
- `POST /diagnostics/trigger-conversion` - Manual conversion (admin auth)
- `GET /diagnostics/volatility` - Market states

## Credentials
- Admin: moxxcompany@gmail.com (DB id: 2)
- Test user: richard@dyno.pt (DB user_id: 28)
- VPS: 95.179.167.16 root / E9o,RRotPdX_d7fC
