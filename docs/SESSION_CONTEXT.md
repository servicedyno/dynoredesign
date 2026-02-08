# DynoPay Development Session Context

**Last Updated:** January 27, 2026  
**Development Space:** cryptopay-fix-1.preview.emergentagent.com

---

## 📋 Project Overview

**DynoPay** is a comprehensive crypto payment gateway backend with multi-tenant support, enabling businesses to accept cryptocurrency payments with automatic fund distribution, admin fee collection, and threshold-based sweeping.

---

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js + TypeScript + Express
  - Main API: Port 8001 (`server.ts`)
  - API Service: Port 3301 (`api-service/`)
- **Frontend**: React (Port 3000)
- **Database**: PostgreSQL (Railway hosted)
- **Cache**: Redis
- **Blockchain**: Tatum API integration
- **Process Manager**: Supervisor

### Repository Structure
```
/app/
├── backend/              # Node.js/TypeScript backend
│   ├── api-service/      # Secondary API service
│   ├── controller/       # Business logic
│   ├── models/           # Sequelize models
│   ├── routes/           # Express routes
│   ├── services/         # Shared services
│   ├── utils/            # Utilities & helpers
│   └── server.ts         # Main entry point
├── frontend/             # React frontend
├── memory/               # Context & documentation
│   └── PRD.md           # Product Requirements Doc
└── test_result.md       # Testing history & results
```

---

## ✅ Completed Features

### Core Payment System
- ✅ Multi-tenant company profiles
- ✅ Cryptocurrency wallet management (BTC, ETH, LTC, DOGE, TRX, USDT)
- ✅ Payment link generation
- ✅ Crypto payment processing with Tatum integration
- ✅ Automatic fund distribution
- ✅ Admin fee collection (tiered: 2% + fixed fee + buffer)
- ✅ Threshold-based payment forwarding
- ✅ **Native ETH/TRX admin fee sweep (NEW - every 15 min)**

### Business Features
- ✅ Tax ID validation (APILayer integration)
- ✅ Dashboard with analytics & charts
- ✅ Notification system with preferences
- ✅ KYC integration (Veriff)
- ✅ Invoice generation system
- ✅ Referral system with bonuses
- ✅ Knowledge base (public & admin)
- ✅ Enhanced API key management (dev/prod environments)

### Documentation & Testing
- ✅ Swagger/OpenAPI documentation (151 endpoints)
- ✅ Comprehensive backend testing (66 tests, 100% pass rate)
- ✅ Payment flow testing & verification
- ✅ Multi-tenancy validation

---

## 🧪 Current Testing Focus

### **Testnet Configuration**
```env
TATUM_TESTNET=true
TATUM_TESTNET_TYPE=ethereum-sepolia
```

### **Payment Flow Testing Goals**
Testing the complete end-to-end Sepolia testnet payment flow:

1. **Payment Creation**
   - Generate unique Sepolia ETH address via `/api/pay/createCryptoPayment`
   - Customer sends testnet ETH to this address

2. **Payment Detection**
   - Tatum webhook triggers on incoming transaction
   - System detects payment and updates status to "confirming"

3. **Payment Confirmation**
   - Wait for blockchain confirmations
   - Update payment status to "confirmed"

4. **Fund Distribution**
   - Calculate merchant amount (payment - 2% fee)
   - Distribute funds to merchant wallet

5. **Admin Sweep**
   - If payment > threshold (ETH: $5 USD), forward to admin wallet
   - Admin wallet: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`

6. **Notifications & Webhooks**
   - Trigger merchant webhooks
   - Create notifications
   - Send email confirmations

### **Payment Thresholds** (USD values for forwarding)
```
BTC_THRESHOLD=7
ETH_THRESHOLD=5
USDT_TRC20_THRESHOLD=10
USDT_ERC20_THRESHOLD=5
TRX_THRESHOLD=5
LTC_THRESHOLD=5
DOGE_THRESHOLD=5
BCH_THRESHOLD=5
```

### **Admin Wallet Addresses** (Platform Fee Collection - from .env)
These wallets RECEIVE collected platform fees, transaction fees, and buffer amounts.
```
BTC=1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7
ETH=0x9a7221b5e32d5f99e8da95585835442e29afb38f
LTC=LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm
DOGE=DEReH1ES1zT8MUtkBQPqLqYGWrJhw2gCUL
TRX=TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR
USDT_TRC20=TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR
USDT_ERC20=0x9a7221b5e32d5f99e8da95585835442e29afb38f
```

### **Gas Fee Wallet Addresses** (from tbl_admin_fee_wallet)
These wallets FUND temporary addresses with ETH/TRX gas for USDT token transfers.
```
ETH=0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c  (for USDT-ERC20 transfers)
TRX=TTXk9SbNj8tnRABdGDM3PZvT5bHqTNtANB        (for USDT-TRC20 transfers)
```

---

## 🔑 Key Test Credentials

### User Account
```
Email: richard@dyno.pt
Password: Katiekendra123@
```

### API Keys (Updated - January 27, 2026)
```
# Veriff KYC (Real Production Credentials)
VERIFF_API_KEY=cryptoprocessor
VERIFF_API_SECRET=cryptoprocessor

# Telnyx SMS (Real Production Credentials)
TELNYX_API_KEY=KEY019B6F591AACFAF1451A80C66809193A_TKJeBs8NaHEaqFkEh2HuYe
TELNYX_VERIFY_PROFILE_ID=cryptoprocessor
PROFILE_ID=cryptoprocessor
```

---

## 🎯 Current Task: Sepolia Payment Flow Testing

### Objective
Test and verify the complete crypto payment flow on Sepolia testnet including:
- Payment address generation
- Tatum webhook processing
- Fund distribution logic
- Admin sweep mechanism
- Notification triggers

### Process
1. **Setup**: Create payment link with ETH/CRYPTO mode
2. **Generate Address**: Call `/api/pay/createCryptoPayment` to get unique payment address
3. **Send Payment**: Transfer Sepolia ETH from faucet to payment address
4. **Monitor**: Watch backend logs for webhook triggers and processing
5. **Verify**: Confirm fund distribution, admin sweep, and notifications

### Monitoring Points
- Backend logs: `/var/log/supervisor/backend.out.log`
- Webhook endpoint: `/api/tatum-crypto-webhook`
- Payment status: `GET /api/pay/links/:id`
- Transactions: `POST /api/wallet/getAllTransactions`

---

## 🔧 Known Issues & Limitations

### Resolved Issues ✅
1. **Webhook URL**: Fixed - now uses `/api/tatum-crypto-webhook` for crypto payments
2. **Wallet Lookup**: Fixed - added fallback for multi-tenant wallet queries

### Current Blockers
1. **Wallet Validation**: Local validation library may reject valid addresses
2. **Testnet Simulation**: Real blockchain confirmations take time

### Minor Issues (from PRD.md)
1. Fee logic defaults (BTC should be $7, currently may be $5)
2. Missing check: Full amount to admin if user receives < $5
3. Google Sign-In needs investigation

---

## 📚 Documentation References

### Key Files
- `/app/memory/PRD.md` - Product Requirements Document
- `/app/test_result.md` - Comprehensive testing history
- `/app/backend/.env` - Environment configuration
- `/app/API_TEST_REPORT_PHASE4-15.md` - API testing results
- `/app/COMPREHENSIVE_TEST_FIXES_2026-01-25.md` - Recent test fixes

### API Documentation
- Swagger UI: `https://code-analyzer-256.preview.emergentagent.com/api/docs`
- OpenAPI Spec: `https://code-analyzer-256.preview.emergentagent.com/api/docs.json`

---

## 🚀 Next Steps

1. **Immediate**: Test additional payment scenarios (below threshold, different currencies)
2. **Short-term**: Verify UTXO chain payments (BTC, LTC)
3. **Medium-term**: Implement remaining P1/P2 features (2FA, Session Management)
4. **Long-term**: Production deployment preparation

---

## 💡 Development Notes

### Environment URLs
- **Backend URL**: `https://code-analyzer-256.preview.emergentagent.com`
- **Checkout URL**: `https://dynocheckoutfix-production.up.railway.app/`
- **Database**: `yamanote.proxy.rlwy.net:42097`

### Service Management
```bash
# Check status
sudo supervisorctl status

# Restart services
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
sudo supervisorctl restart all

# View logs
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/frontend.out.log
```

### Important Notes
- Hot reload is enabled for frontend and backend
- Only restart when installing dependencies or changing .env
- MongoDB service listed but NOT used (PostgreSQL is the database)
- All API routes must be prefixed with `/api` for Kubernetes routing

---

## 📝 Session History

### Previous Session
- Attempted Sepolia payment testing
- Created payment links successfully
- Encountered confusion with address generation vs merchant wallets
- Reverted test changes to maintain clean state

### Current Session (January 27, 2026)
- ✅ Updated Veriff KYC credentials (real API keys)
- ✅ Updated Telnyx SMS verification credentials  
- ✅ Fixed test user credentials (richard@dyno.pt password reset)
- ✅ Verified login working successfully
- ⏳ Ready for KYC and SMS testing with production credentials

---

## 🎉 Successful Payment Test (January 27, 2025)

### **Test Results**
| Field | Value |
|-------|-------|
| **Payment Address** | `0x10772cFa7444B1E318a30b378B650494e5EE2B26` |
| **Amount Received** | 0.05 ETH (~$145.83 USD) |
| **Merchant Received** | 0.04791427 ETH (95.83%) |
| **Admin Fee Retained** | 0.00208573 ETH (4.17%) |
| **Merchant TX** | `0xafee3f15a4850834dca9f0df740e99a45d3489cd5ea194ba8a5a4cc0e937a6c4` |
| **Transaction ID** | `fdfd02f2-e737-4895-9547-2433ee1207df` |
| **Status** | ✅ Successful |

### **Fee Breakdown**
- Total Deduction: $6.08 USD (4.17%)
- Includes: 2% platform fee + $3 fixed fee + 1% buffer (Tier 1)

### **Issues Found & Fixed During Testing**

1. **Webhook URL Issue**
   - **Problem**: `addPayment` called `Crypto()` without `onlyCrypto=true`, registering webhook to `/api/tatum-webhook` instead of `/api/tatum-crypto-webhook`
   - **Fix**: Added `onlyCrypto=true` parameter to trigger proper `cryptoVerification`

2. **Wallet Lookup Issue (Multi-tenant)**
   - **Problem**: Wallet query with `company_id: 3` failed when merchant wallet had `company_id: null`
   - **Fix**: Added fallback to retry wallet lookup without company_id constraint

### **Payment Flow Verified**
```
1. ✅ Payment link created (link_id: 144)
2. ✅ Crypto payment initiated → Sepolia address generated
3. ✅ Tatum subscription created for address monitoring
4. ✅ Customer sent 0.05 ETH to payment address
5. ✅ Webhook received at /api/tatum-crypto-webhook
6. ✅ cryptoVerification processed payment
7. ✅ Fee calculation: $145.83 - $6.08 = $139.75 to merchant
8. ✅ Merchant transfer executed: 0.04791427 ETH
9. ✅ Admin fee retained: 0.00208573 ETH (pending_sweep)
10. ✅ Transaction recorded as successful
11. ✅ Email notifications sent via Brevo
12. ✅ Admin sweep cron executed (see below)
```

---

## 🎉 Admin Fee Sweep Verification (January 27, 2025)

### **Sweep Execution Results**
| Field | Value |
|-------|-------|
| **Temp Address** | `0x10772cFa7444B1E318a30b378B650494e5EE2B26` |
| **Admin Fee Swept** | 0.00204373 ETH (~$5.96 USD) |
| **Sweep TX** | `0x406abb34628b7b8179d40080c830043c06400973deff88529fd6cc346f19d5ff` |
| **Gas Used** | 0.0001 ETH |
| **admin_status** | `pending_sweep` → `successful` ✅ |

### **Database Records Updated**
- **tbl_user_temp_address**: `admin_status = 'successful'`, `adminTxId` contains both merchant + sweep TX
- **tbl_admin_fee_transaction**: New record created with `transaction_type = 'CREDIT'`

### **Cron Job Verified**
The `sweepNativeAdminFees` cron (every 15 min) successfully:
- ✅ Queried pending addresses with `admin_status = 'pending_sweep'`
- ✅ Transferred admin fees to admin wallet
- ✅ Deducted gas fees (0.0001 ETH)
- ✅ Updated database records
- ✅ Logged transaction details

---

## 🔄 Admin Fee Sweep System

### **Fee Structure (Configurable via .env)**

| Component | Description | Env Variable |
|-----------|-------------|--------------|
| Transaction Fee | 2% of payment | `TRANSACTION_FEE_PERCENT` |
| Fixed Fee | USD amount by tier | `FEE_TIER_X_FIXED` |
| Buffer | % for blockchain volatility | `FEE_TIER_X_BUFFER` |

### **Fee Tiers**
| Tier | Amount Range | Fixed Fee | Buffer |
|------|-------------|-----------|--------|
| 1 | $5 - $100 | $3.00 | 1.0% |
| 2 | $101 - $500 | $2.00 | 0.8% |
| 3 | $501 - $1000 | $1.50 | 0.5% |
| 4 | $1001+ | $1.00 | 0.3% |

### **Cron Job Schedule**
| Job | Schedule | Function | Chains |
|-----|----------|----------|--------|
| `processIncompletePayments` | */10 min | Retry incomplete payments | All |
| `checkFeeBalance` | */15 min | Alert if fee wallet low | All |
| `sweepNativeAdminFees` | */15 min | Sweep native admin fees | **ETH, TRX** |
| `checkingUSDT` | */30 min | Sweep USDT to merchant | USDT-ERC20, USDT-TRC20 |
| `sendingLeftover` | */50 min | Sweep leftover gas | ETH, TRX (from USDT) |

### **Admin Fee Handling by Chain Type**

| Chain | Type | Handling | Sweep Required |
|-------|------|----------|----------------|
| BTC, LTC, DOGE, BCH | UTXO | Immediate (single TX with 2 outputs) | ❌ No |
| USDT-ERC20 | Token | Pending → cron sweep | ✅ Every 30 min |
| USDT-TRC20 | Token | Pending → cron sweep | ✅ Every 30 min |
| ETH | Native | pending_sweep → cron | ✅ Every 15 min (NEW) |
| TRX | Native | pending_sweep → cron | ✅ Every 15 min (NEW) |

### **Sweep Flow for Native ETH/TRX**
```
1. Payment received → Merchant gets (amount - fees)
2. Admin fee portion stays in temp address
3. admin_status set to "pending_sweep"
4. Cron job (every 15 min) queries pending addresses
5. Transfers admin fee to admin wallet
6. Updates admin_status to "successful"
```

---

## 🔐 Wallet Generation & Security

### **Key Management**
- **Tatum SDK**: Generates wallets (mnemonic + xpub)
- **Google Cloud KMS**: Encrypts all private keys before DB storage
- **Key Ring**: `admin-ring` (PROJECT_ID: `newdyno`)

### **Testnet vs Mainnet**
| Aspect | Testnet (Sepolia) | Mainnet |
|--------|-------------------|---------|
| API Key | `TATUM_TESTNET_KEY` | `TATUM_KEY` |
| ETH Address | Derived from privkey | From xpub |
| Private Key Storage | Google KMS ✅ | Google KMS ✅ |

---

**For Questions or Issues**: Refer to PRD.md and test_result.md for detailed implementation history and testing outcomes.
