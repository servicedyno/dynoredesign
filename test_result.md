# DynoPay - Test Results

## Pod URL Setup
- **Pod URL**: `https://6e7bd34c-a2a2-4629-b5d5-e62405341470.preview.emergentagent.com`
- **Frontend** (`/app/.env.local`): `NEXT_PUBLIC_BASE_URL=https://6e7bd34c-a2a2-4629-b5d5-e62405341470.preview.emergentagent.com/`
- **Frontend** (`/app/frontend/.env`): `REACT_APP_BACKEND_URL=https://6e7bd34c-a2a2-4629-b5d5-e62405341470.preview.emergentagent.com`
- **Backend** (`/app/backend/.env`): `SERVER_URL`, `CHECKOUT_URL`, `FRONTEND_URL` all set to `https://6e7bd34c-a2a2-4629-b5d5-e62405341470.preview.emergentagent.com`

## Changes Made - Session (Dashboard Data Fix)

### Issues Fixed:
1. **Dashboard volume was $0.00** → Now shows **$4,679.25 USD**
   - Root cause: `usd_value` column was 0 in DB for all 94 transactions
   - Fix 1: Added USD fallback expression in `dashboardController.ts` volume/chart/fee-tier queries
   - Fix 2: Populated `usd_value` column with correct USD values (crypto_amount × market price)

2. **Chart missing data** → Now shows 22 days with proper USD volumes
   - Same root cause as #1, same fix applied to chart and currency breakdown queries

3. **Transaction history page empty** → Now returns all 94 transactions
   - Root cause: `buildTransactionFilters` in `walletController.ts` used `cm.company_id` (via customer JOIN) but `customer_id` was NULL
   - Fix: Changed to `(ut.company_id = :company_id OR cm.company_id = :company_id)` matching dashboard approach

### Files Modified:
- `backend/controller/dashboardController.ts` - USD fallback for volume, chart, currency breakdown, fee-tier queries
- `backend/controller/walletController.ts` - Company filter fix in `buildTransactionFilters`
- Database: Updated `usd_value` column for 94 transactions (user_id=4, company_id=3)

### Testing Protocol
- Backend API tested via curl
- Dashboard: 94 txns, $4,679.25 total, $1,802.71 this month
- Chart: 22 days with volume data in 30d period
- Transactions: 94 returned for company_id=3
