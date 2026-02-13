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

## Fee Structure (Updated Feb 13, 2026)
**Formula**: `Fee = 1.5% + tier fixed fee + dynamic gas (at settlement)`

| Tier | Range | Fixed Fee |
|------|-------|-----------|
| 1 | $1–$100 | $1.00 |
| 2 | $101–$500 | $1.00 |
| 3 | $501–$1000 | $1.00 |
| 4 | $1001+ (unlimited) | $1.00 |

- Buffer completely removed from code and .env
- Gas costs: UTXO deducted from merchant, account-based chains from admin portion (pending change to deduct from merchant)
- Admin can adjust per-tier fixed fees independently

## Auto-Convert Pipeline (Optimized Feb 13, 2026)
- Immediate sweep trigger after auto-convert payment (0 delay, was 3-5 min)
- Conversion cron: every 2 min (was 5 min)
- Non-auto-convert: unchanged (time:3 native, threshold tokens, batch UTXO)

## What's Been Implemented

### Sessions 1-10 (Feb 12, 2026)
- Full codebase analysis, security audit, security improvements
- Binance Convert API -> Spot Market Orders
- Adaptive Conversion System (volatility monitor, fee rate service, Limit IOC)
- Auto-conversion payout email template
- Auto-Convert wallet selection flow improvements
- Brevo fix + error logging consolidation

### Session 11 (Feb 12-13, 2026)
- SOCKS5 proxy tunnel for Binance connectivity
- Fixed notification logic, permissive Tatum webhook validation
- Removed double withdrawal fee deduction
- Reworked deposit_tx_hash auto-population
- Two end-to-end test payments completed

### Session 12 (Feb 13, 2026)
- **Auto-convert speed optimization**: immediate sweep + 2-min cron
- **Fee structure overhaul**: 3-component → 2-component (1.5% + $1 fixed)
- Buffer removed from: feeConfigUtils.ts, controller/index.ts, paymentController.ts, invoiceController.ts, types/index.ts, merchantPoolSweep.ts
- DB models kept for backwards compat (old records retain buffer values)

## Volatile Currencies (subject to auto-conversion)
BTC, ETH, LTC, DOGE, TRX, BCH, SOL, XRP, POLYGON

## Key Environment Config
- `TRANSACTION_FEE_PERCENT=1.5`
- `FEE_TIER_*_FIXED=1.00` (all tiers), `FEE_TIER_*_BUFFER` removed
- `FEE_TIER_4_MAX=` (empty = unlimited)
- `BINANCE_CONVERT_INTERVAL_MINUTES=2`
- `BINANCE_PROXY_URL=socks5://127.0.0.1:1080`

## Prioritized Backlog

### P0 - Next
- [ ] Implement dynamic gas fee deduction from merchant payout (account-based chains)
- [ ] Run live test payment with new fee structure

### P1
- [ ] Create persistent autossh tunnel
- [ ] Deploy changes to Railway production

### P2 - Future
- [ ] Refactor monolithic paymentController.ts (~4600 lines)
- [ ] Admin panel UI for tier fee management
- [ ] Refactor addressService.ts sweep logic

## Key Files
- `backend/controller/paymentController.ts` - Payment flow + fee calc + auto-convert + immediate sweep
- `backend/controller/index.ts` - calculateTransactionFees (buffer removed)
- `backend/utils/feeConfigUtils.ts` - Fee tier config (buffer removed)
- `backend/types/index.ts` - FeeTier/FeeCalculationResult types (buffer removed)
- `backend/services/conversionService.ts` - Conversion pipeline (4 phases)
- `backend/services/binanceService.ts` - Spot trading, withdrawal
- `backend/services/merchantPool/merchantPoolSweep.ts` - Sweep logic

## Credentials
- Admin: moxxcompany@gmail.com (DB id: 2)
- Test user: richard@dyno.pt (DB user_id: 28)
- VPS: 95.179.167.16 root / E9o,RRotPdX_d7fC
