# ✅ DynoPay Backend Environment - CORRECTED SETUP

## Date: 2026-01-25

## 🔧 Critical Corrections Applied

### 1. **Database Clarification**
- **Database Type**: PostgreSQL (NOT MongoDB)
- **Connection Details**:
  - Host: yamanote.proxy.rlwy.net
  - Port: 42097
  - Database: db_bozzwallet
  - User: postgres
- **Note**: MongoDB service in supervisor is a leftover from template but NOT used by DynoPay

### 2. **Backend URL Updated to Current Development URL**
- **Previous URL**: https://trustline-install.preview.emergentagent.com
- **Current Development URL**: `https://trustline-install.preview.emergentagent.com`
- Updated in both `/app/backend/.env` and `/app/frontend/.env`

### 3. **Backend Architecture Clarified**
DynoPay backend is a **Node.js/Express/TypeScript** application, NOT Python:

#### Server Processes:
- **Main Backend API** (Port 3300): Node.js/Express/TypeScript
  - File: `/app/backend/server.ts`
  - Process: `ts-node --transpile-only server.ts`
  
- **API Service** (Port 3301): Node.js/TypeScript
  - File: `/app/backend/api-service/server.ts`
  - Process: `ts-node --transpile-only api-service/server.ts`

- **Port 8001**: Python uvicorn (supervisor fallback, not actively used)

#### Active Services Status:
```
✅ Main Backend (Node.js)    - Running on port 3300
✅ API Service (Node.js)      - Running on port 3301  
✅ Frontend (React)           - Running on port 3000
✅ PostgreSQL                 - Connected (Railway)
✅ Redis                      - Connected (Railway)
```

## 📊 Updated Environment Configuration

### Backend Environment (/app/backend/.env)

#### Core Server Settings
```bash
PORT=8001                    # External port mapping
API_SERVICE_PORT=3301        # API service port
SERVER_URL=https://trustline-install.preview.emergentagent.com
CHECKOUT_URL=https://checkout.dynopay.com
```

#### Database (PostgreSQL on Railway)
```bash
DB_NAME=db_bozzwallet
USER_NAME=postgres
PASSWORD=oMHQMHfnrFyWgkhYaiXbhjDEMZSWOapc
HOST=yamanote.proxy.rlwy.net
DB_PORT=42097
```

#### Redis Cache
```bash
REDIS_PUBLIC_URL=redis://default:fgPwEPwoyHhbAeDhPJakxOByMoNyUSpw@crossover.proxy.rlwy.net:37463
```

#### Authentication & Security
```bash
ACCESS_TOKEN=KEY019B6F591AACFAF1451A80C66809193A_TKJeBs8NaHEaqFkEh2HuYe
ACCESS_TOKEN_SECRET=9a88a50f97ef03c08fedc2e1823e6e4da7220d1a94d8200dde4e8bf63ceab2216e848003b38cae225e5a7620c77ac735e1c5b5418407953b85c203c3e5192d4e
API_SECRET=e8b1e1d919cd273a19cb77f8ce349e386e3f051d5d2f858f
CYPHER_KEY=e4361761333af9b6a3120cc919db25eb8515d4f425bf22de31ea1ff60f3d695778b83a1e94f2d482226d38a6557a6688bb71145c3f5bedc85ce36e3c448a7399
```

#### Payment Gateway - Flutterwave (PRODUCTION)
```bash
FLW_PUBLIC_KEY=FLWPUBK-ddc943c22490b7473acafe64ad27c9cf-X
FLW_SECRET_KEY=FLWSECK-111d21dd05d15e5a4eb0448c0150f2c2-197c4e73866vt-X
FLW_SECRET_HASH=13d1c994e1391d3864afb7e58b3b675fd2ad63f7800f9b881140174e78a1ac7e
FLW_ENCRYPTION_KEY=111d21dd05d1bd22322fd5ff
```

#### Blockchain APIs
```bash
# Tatum API
TATUM_KEY=t-6706960c3810b72fabd57312-027b8552a61a4119bb58eba0
TATUM_SECRET_KEY=t-66b4afa3e69f83001c4f4733-8238f8dec518479d8e59853a

# Crypto APIs
CRYPTO_PUBLIC_KEY=18d3afce-cd58a730-003e58ce-yh4fhmvs5k
CRYPTO_SECRET_KEY=6a5f0229-ed893fb6-51ae4b7a-209b1
BLOCK_BEE_API_KEY=AQ7cxJgOcFWjPof7VjCrMWiZEqyAErb2jQDhakRUHcKZmlr7J9DgVgiAzBT0mNlu
BLOCKCHAIR_API_KEY=A___WuA9OWL6dtzHIt681S6VXZEZiDMX
```

#### Contract Addresses
```bash
ETH_CONTRACT=0xdac17f958d2ee523a2206206994597c13d831ec7
TRX_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
```

#### Google Cloud KMS (Key Management)
```bash
PROJECT_ID=newdyno
LOCATION_ID=global
KEY_RING_ID=admin-ring
PRIVATE_KEY_ID=wallet-keys
TEMP_KEY_ID=temp-address-key
XPUB_KEY_ID=keys-for-xpubs
GOOGLE_CLIENT_EMAIL=dynopay-manager@newdyno.iam.gserviceaccount.com
GOOGLE_CLIENT_KEY=[Private key configured]
```

#### Admin Wallet Addresses
```bash
BTC=1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7
ETH=0x9a7221b5e32d5f99e8da95585835442e29afb38f
LTC=LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm
DOGE=DEReH1ES1zT8MUtkBQPqLqYGWrJhw2gCUL
TRX=TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR
USDT_TRC20=TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR
USDT_ERC20=0x9a7221b5e32d5f99e8da95585835442e29afb38f
```

#### Blockchain Thresholds (Min Forwarding Amount in USD)
```bash
BTC_THRESHOLD=7
ETH_THRESHOLD=5
USDT_TRC20_THRESHOLD=10
USDT_ERC20_THRESHOLD=5
TRX_THRESHOLD=5
LTC_THRESHOLD=5
DOGE_THRESHOLD=5
BCH_THRESHOLD=5
```

#### Fee Configuration
```bash
TRANSACTION_FEE_PERCENT=2.0

# Fee Tiers by Transaction Amount
# Tier 1: $5 - $100
FEE_TIER_1_MIN=5
FEE_TIER_1_MAX=100
FEE_TIER_1_FIXED=3
FEE_TIER_1_BUFFER=1.0

# Tier 2: $101 - $500
FEE_TIER_2_MIN=101
FEE_TIER_2_MAX=500
FEE_TIER_2_FIXED=2
FEE_TIER_2_BUFFER=0.8

# Tier 3: $501 - $1000
FEE_TIER_3_MIN=501
FEE_TIER_3_MAX=1000
FEE_TIER_3_FIXED=1.5
FEE_TIER_3_BUFFER=0.5

# Tier 4: $1001+
FEE_TIER_4_MIN=1001
FEE_TIER_4_MAX=0
FEE_TIER_4_FIXED=1
FEE_TIER_4_BUFFER=0.3
```

#### External Services
```bash
FAST_FOREX_KEY=88d0f6fc99-ddde24c462-t97lpe
BREVO_API_KEY=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
INFOBIP_API_KEY=0da2495c4f0e5d3453b448a63bb3b2a2-0a80afbf-db6c-4c59-a7a2-c88a1b13d164
TELEGRAM_BOT_TOKEN=7098839658:AAFBGaj4OpIoH-HzVQ3h1rzf2DrvsVso9yI
```

#### Telnyx SMS Verification
```bash
TELNYX_API_KEY=...
TELNYX_VERIFY_PROFILE_ID=apidocs-overhaul
PROFILE_ID=dynopay-api-test
```

#### Tax & Identity Verification Services
```bash
# APILayer Tax Data API
TAX_DATA_API_URL=https://api.apilayer.com/tax_data
TAX_DATA_API_KEY=If5U0zLLWBd3GKanYoE5H5zaSpLeQDGo

# Veriff Identity Verification (KYC)
VERIFF_API_KEY=dynopay-api-test
VERIFF_API_SECRET=dynopay-api-test
```

#### Admin Configuration
```bash
ADMIN_EMAIL=moxxcompany@gmail.com
CUSTOMER_ID=6708cc37177ff63b812c0db9
```

### Frontend Environment (/app/frontend/.env)
```bash
REACT_APP_BACKEND_URL=https://trustline-install.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

## 🎯 API Endpoints Available

### Main Backend API (Port 3300)
- **Swagger Documentation**: `https://trustline-install.preview.emergentagent.com/api/docs`
- **Base API URL**: `https://trustline-install.preview.emergentagent.com/api`

### API Service (Port 3301)
- Additional API service for specific operations

## 📋 Tech Stack Summary

| Component | Technology | Port |
|-----------|-----------|------|
| Backend API | Node.js + Express + TypeScript | 3300 |
| API Service | Node.js + TypeScript | 3301 |
| Frontend | React 19 + Tailwind CSS | 3000 |
| Database | PostgreSQL (Railway) | 42097 |
| Cache | Redis (Railway) | 37463 |
| Payment Gateway | Flutterwave | API |
| Blockchain | Tatum, CryptoAPI, BlockBee, Blockchair | API |
| Email | Brevo API | API |
| SMS | Infobip, Telnyx | API |
| KYC | Veriff | API |
| Tax Validation | APILayer | API |
| Key Management | Google Cloud KMS | API |

## ✅ Current Status

```
✅ PostgreSQL Database    - Connected to Railway
✅ Redis Cache            - Connected to Railway  
✅ Backend API (Node.js)  - Running on port 3300
✅ API Service (Node.js)  - Running on port 3301
✅ Frontend (React)       - Running on port 3000
✅ Environment Variables  - Updated with current development URL
✅ All Dependencies       - Installed
```

## 🚀 Next Steps

The environment is fully configured and ready for:

1. **Feature Development**: Implement new payment flows or crypto integrations
2. **Testing**: Run comprehensive API and integration tests
3. **Bug Fixes**: Address any issues reported in test_result.md
4. **Deployment**: Deploy to production when ready
5. **Monitoring**: Set up alerts for payment processing and blockchain operations

## ⚠️ Important Notes

- **Database**: Uses PostgreSQL on Railway, NOT MongoDB (MongoDB process is inactive)
- **Backend**: Node.js/TypeScript application, NOT Python
- **Current URL**: Always use the current development URL from supervisor config
- **Security**: All production API keys and credentials are configured
- **Multi-Currency**: Supports BTC, ETH, LTC, DOGE, TRX, USDT (ERC20 & TRC20)

---
**Last Updated**: 2026-01-25  
**Environment**: Development  
**Status**: ✅ Ready for Development
