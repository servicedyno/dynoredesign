# DynoPay - Cryptocurrency Payment Gateway

## Original Problem Statement
Build a cryptocurrency payment gateway that processes end-to-end payment lifecycle for multiple cryptocurrencies. The core task is ensuring payments are tracked from initial webhook, funds swept, converted via Binance, and settled to merchants.

## Architecture
- **Backend**: Node.js/Express/TypeScript (port 3300, proxied via Python/uvicorn on 8001)
- **Database**: PostgreSQL (Railway)
- **Cache/Lock**: Redis (Railway)
- **Blockchain API**: Tatum
- **Exchange**: Binance (via SSH tunnel)
- **Email**: Brevo

## What's Been Implemented

### Session 2026-02-15 - BCH Payment Fix & All 5 Payments Verified

**Bug Fixes Applied:**
1. **BCH CashAddr normalization** (`tatumApi.ts`): All BCH addresses normalized to CashAddr format using `bchaddrjs` library
2. **BCH UTXO output index matching** (`tatumApi.ts`): `findUtxoOutputIndex` now compares both CashAddr and legacy format
3. **BCH sweep dust fix** (`tatumApi.ts`): Removed explicit fee+changeAddress from `bchTransferBlockchain` call, letting Tatum auto-calculate to avoid dust change outputs
4. **Redis null key safety** (`redisInstance.ts`): `getRedisItem` returns empty object for null/undefined keys
5. **Currency conversion null safety** (`currencyConvert.ts`): `normalizeCurrency` defaults to 'USD' for undefined input
6. **Company lookup fallback** (`paymentController.ts`): `cryptoVerification` falls back to `tempData.company_id` if `customerData.company_id` is undefined
7. **UTXO fee floor** (`paymentController.ts`): BCH uses minimum 0.00001 BCH fee to avoid dust
8. **Satoshi-level arithmetic** (`paymentController.ts`): Integer math for UTXO amounts to avoid floating-point precision issues

**Payment Status (All 5 Test Payments):**
| Currency | Status | Sweep TX |
|----------|--------|----------|
| BTC | ✅ Completed | 1056f0cf... |
| SOL | ✅ Completed | 5Anu375i... |
| POLYGON | ✅ Completed | 0x9c70cc... |
| DOGE | ✅ Completed | 0811bcb2... |
| BCH | ✅ Completed | bbdbd728... |

### Previous Session Work
- Graceful shutdown logic
- Redis stale lock cleanup + auto-renewal
- SOL rent-exemption fee handling
- Binance SSH tunnel supervisor config

## Key Files Modified
- `backend/apis/tatumApi.ts` - BCH CashAddr normalization, dust fix
- `backend/controller/paymentController.ts` - UTXO fee/amount fixes, null safety
- `backend/helper/currencyConvert.ts` - Null safety for normalizeCurrency
- `backend/utils/redisInstance.ts` - Null key protection
- `backend/webhooks/index.ts` - (no changes this session)

## Dependencies Added
- `bchaddrjs` - BCH address format conversion

## Remaining / Future Items
- **Stablecoin Conversion**: BCH conversion record #24 is PENDING_DEPOSIT (needs Binance tunnel active in production)
- **Binance Tunnel**: Geo-blocked in this preview environment (sshpass not available). Works in production with non-US server.
- **Original user_transaction records**: Still in `pending`/`received` status in `tbl_user_transaction` (customer_transaction table has correct `successful` status)
