# DynoPay - Test Results & Session Tracker

## App Overview
DynoPay is a full-stack crypto payment gateway. 
- **Frontend**: Next.js (port 3000) with MUI components
- **Backend**: Node.js/Express/TypeScript (port 3300 internally, proxied via Python/uvicorn on port 8001)
- **Database**: PostgreSQL (Railway), Redis (Railway), MongoDB (local)
- **Integrations**: Tatum API, Binance, Flutterwave, Google Cloud KMS, TRON

## Current Setup Status
- ✅ Frontend: Running (Next.js on port 3000)
- ✅ Backend: Running (Node.js on port 3300, Python proxy on port 8001)
- ✅ MongoDB: Running
- ⚠️ Binance WebSocket: Geo-blocked (expected in this environment)

## Previous Session Completed Work
1. Fixed TRON `OUT_OF_ENERGY` transaction confirmation bug in `tatumApi.ts`
2. Added settlement retry logic in `paymentController.ts`
3. Improved recovery endpoint in `diagnosticsRouter.ts`
4. Successfully recovered 98.7577 USDT stuck funds

## Known Outstanding Issues
- **P1**: TRX hot wallet depletion monitoring
- **P1**: Merchant webhook 404 error at `lockbaypaymentfixing-production.up.railway.app/webhook/dynopay`

---

## Testing Protocol

### Backend Testing
- Use `deep_testing_backend_v2` for backend testing
- Backend base URL: `http://localhost:8001`
- All API routes prefixed with `/api`

### Frontend Testing  
- Only test frontend with explicit user permission
- Use `auto_frontend_testing_agent` for frontend testing
- Frontend URL: `http://localhost:3000`

### Incorporate User Feedback
- Always ask user before making changes based on test results
- Do not fix minor issues without user approval
