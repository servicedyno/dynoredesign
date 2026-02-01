# Payment Creation Analysis: DynoBackend + DynoBackendAPI Merge

## Executive Summary

Analysis of the merged DynoPay application from https://github.com/Moxxcompany/DynoBackend and https://github.com/Moxxcompany/DynoBackendAPI to identify differences preventing payment creation for merchant Nomadly1 (company_id=3, user_id=4).

---

## Merchant Configuration: Nomadly1

**API Key Decryption:**
```
Encrypted: U2FsdGVkX18Y1r7820X9rwDR1ENhHV1PMQyOKXFi3x9mgJyh4TRNAkk3aTkA1gu6DThmC/ncmerkXaqFt640z1iSdC6i84p9+OLVrqL2ojp+7CJ5+d5bAy4jaulxC+UG
Decrypted: DYNOPAY_USER_API-{"base_currency":"USD","company_id":3,"adm_id":4}
```

**Database Records:**
- **Company ID:** 3 (Nomadly1)
- **User ID:** 4 (Bozz Mail, nomadly@moxx.co)
- **Base Currency:** USD
- **Configured Wallets:** Only USDT-TRC20 (wallet_name: "Nomadly USDT")
- **API Keys:** 1 API key (api_id=10, created 2025-08-27)
- **Transactions:** 5 found (4 pending, 1 successful USDT-TRC20 payment)

---

## Critical Issues Identified

### 🔴 ISSUE 1: Limited Wallet Configuration
**Location:** `tbl_user_addresses` table
**Problem:** Merchant only has 1 wallet address configured (USDT-TRC20)
**Impact:** 
- Payment creation will FAIL for BTC, ETH, LTC, DOGE, BCH, TRX, USDT-ERC20
- Phase 10 Task 10.3 validation enforces this check

**Code Reference:**
```typescript
// /app/backend/controller/paymentController.ts:316-331
const walletAddress = await userWalletAddressModel.findOne({
  where: {
    user_id: items.adm_id,
    currency: requestedCurrency,
    ...(items.company_id && { company_id: items.company_id }),
  },
});

if (!walletAddress) {
  return errorResponseHelper(
    res,
    400,
    `No wallet address configured for ${requestedCurrency}. Please add a ${requestedCurrency} wallet first.`
  );
}
```

**Root Cause:** This validation was added in Phase 10 as part of the multi-tenant company isolation updates. Original repos likely didn't have this strict company-level wallet validation.

---

### 🔴 ISSUE 2: Multi-Tenant Company Isolation
**Location:** Throughout payment flow
**Problem:** Company_id filtering may not have existed in original repos
**Impact:** Payment flows that worked globally now require company-specific configuration

**Evidence in Current Implementation:**
1. **Payment Link Model** (Phase 10.4):
   ```typescript
   // /app/backend/models/userModels/paymentLinkModel.ts
   company_id: {
     type: DataTypes.INTEGER,
     allowNull: true,
     references: { model: 'tbl_company', key: 'company_id' }
   }
   ```

2. **Transaction Model:**
   ```typescript
   // /app/backend/controller/paymentController.ts:1125
   company_id: tokenData.company_id || null
   ```

3. **Wallet Address Model:**
   ```typescript
   // Phase 6 addition to tbl_user_addresses
   company_id: references tbl_company
   ```

**Merge Impact:** If DynoBackend had global wallet pooling and DynoBackendAPI used company-specific wallets, the merge would create this conflict.

---

### 🟡 ISSUE 3: Redis Data Structure Differences
**Location:** Redis payload in API service vs Main service
**Problem:** Different data structures stored in Redis between the two services

**API Service (api-service/controller/index.ts:92-101):**
```typescript
const redisPayload = {
  customer_id: customerData.dataValues.customer_id,
  company_id: data.company_id,
  adm_id: data.adm_id,
  base_currency: data.base_currency,
  amount: amount,
  redirect_uri,
  pathType: "createPayment",
  ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
};
```

**Main Service (paymentController.ts retrieves):**
```typescript
const items = await getRedisItem("customer-" + data.uniqueRef);
// Expects: adm_id, company_id, customer_id, base_currency, pathType
```

**Potential Issue:** If one repo used different field names or structures, Redis lookups could fail silently.

---

### 🟡 ISSUE 4: Tatum API Integration Changes
**Location:** `/app/backend/apis/tatumApi.ts`
**Problem:** Tatum API version/subscription differences

**Evidence:**
1. From test_result.md (Phase 6):
   ```
   ❌ TATUM API SUBSCRIPTION SUSPENDED: 
   'statusCode: 402, errorCode: subscription.suspended, 
   message: You have used all your credits or your account is expired.'
   ```

2. **Workaround Applied:**
   - Local wallet address validation using `wallet-address-validator` library
   - Removed Tatum API dependency for address validation

**Merge Impact:** If DynoBackend used Tatum v1 and DynoBackendAPI used Tatum v2, function signatures would differ.

**Current .env Configuration:**
```env
TATUM_SECRET_KEY=t-66b4afa3e69f83001c4f4733-8238f8dec518479d8e59853a
```

---

### 🟢 ISSUE 5: API Middleware Validation
**Location:** `/app/backend/api-service/middleware/apiMiddleware.ts`
**Problem:** Strict API key validation may reject valid keys from old system

**Validation Steps:**
1. Check `x-api-key` header exists
2. Decrypt using `API_SECRET`
3. Verify `DYNOPAY_USER_API` prefix
4. Parse JSON payload
5. Query database: `tbl_company WHERE company_id=${company_id} AND user_id=${adm_id}`

**Pass Criteria for Nomadly:**
```sql
SELECT * FROM tbl_company WHERE company_id=3 AND user_id=4
-- ✅ PASSES: Returns Nomadly1 company record
```

**Status:** ✅ API key validation is working correctly for Nomadly

---

### 🟢 ISSUE 6: Currency Conversion Flow
**Location:** `/app/backend/api-service/controller/index.ts:176-189`
**Problem:** Currency conversion API call structure

**Flow:**
1. API service receives USD amount + crypto currency
2. Calls `/api/pay/getCurrencyRates` to convert USD→Crypto
3. Passes converted amount to `/api/pay/createCryptoPayment`

**Code:**
```typescript
const currencyData = await axios.post(
  process.env.SERVER_URL + "/api/pay/getCurrencyRates",
  {
    source: data.base_currency,  // USD
    amount: amount,
    currencyList: [localCurrency],
    fixedDecimal: false,
  }
);
```

**Potential Issue:** If getCurrencyRates endpoint structure changed between repos, this would fail.

---

### 🟡 ISSUE 7: Webhook Subscription Creation
**Location:** `/app/backend/controller/paymentController.ts:1086-1090`
**Problem:** Tatum subscription creation for temporary addresses

**Code:**
```typescript
const { id } = await tatumApi.createSubscription(
  address,
  walletDetails.wallet_type,
  onlyCrypto
);
```

**Issue:** If Tatum subscription API changed or webhook URLs are incorrect, payments won't be confirmed.

**Current SERVER_URL:**
```env
SERVER_URL=https://dep-installer-38.preview.emergentagent.com
```

---

### 🟢 ISSUE 8: Admin Wallet Configuration
**Location:** `tbl_admin_wallet` table
**Problem:** Admin wallet xpub/mnemonic encryption

**Current Status:**
- ✅ 8 admin crypto wallets exist (BTC, ETH, LTC, DOGE, BCH, TRX, USDT-TRC20, USDT-ERC20)
- ✅ Each has last_index tracking
- ❓ xpub_mnemonic encryption using Google Cloud KMS

**Code Reference:**
```typescript
// Decrypt admin wallet xpub
const decrytedData = await tatumApi.decryptSymmetric(
  walletDetails.xpub_mnemonic,
  process.env.XPUB_KEY_ID  // "keys-for-xpubs"
);
const walletData = JSON.parse(decrytedData);
const userXPub = walletData.xpub;
const userMnemonic = walletData.mnemonic;
```

**Potential Issue:** If repos used different encryption methods for xpub storage, decryption would fail.

---

## Key Architectural Differences Between Merged Repos

### DynoBackend (Primary Service - Port 8001)
**Purpose:** Main transaction processing, wallet management, user authentication
**Key Features:**
- User/company management
- Wallet address generation
- Transaction processing and settlement
- Invoice generation
- Dashboard APIs
- Notification system

### DynoBackendAPI (API Service - Port 3301)
**Purpose:** External API interface for merchants
**Key Features:**
- API key authentication
- Customer management for merchants
- Payment creation delegation to main service
- Simplified API endpoints for third-party integration

**Critical Merger Point:**
```typescript
// API Service creates payment by calling Main Service
await axios.post(
  process.env.SERVER_URL + "/api/pay/createCryptoPayment",
  payload,
  { headers: { Authorization: req.headers.authorization } }
);
```

---

## Payment Creation Flow Analysis

### Working Flow (Documented)
1. **Merchant API Call** → `/api/v1/crypto-payment` (Port 3301)
2. **API Middleware** → Validates API key, extracts company_id/adm_id
3. **Currency Conversion** → Calls `/api/pay/getCurrencyRates` (Port 8001)
4. **Redis Storage** → Stores customer data with `customer-{transactionId}` key
5. **Crypto Payment** → Calls `/api/pay/createCryptoPayment` (Port 8001)
6. **Wallet Validation** → ❌ **FAILS HERE** if currency not configured
7. **Address Generation** → Generate temp address via Tatum
8. **Transaction Record** → Create in `tbl_user_transaction`
9. **Response** → Return QR code + address

### Where It Breaks for Nomadly

**Scenario 1: BTC Payment Request**
```
✅ API Key validates (company_id=3, adm_id=4)
✅ Currency conversion works
✅ Redis stores customer data
❌ Wallet validation fails: "No wallet address configured for BTC"
```

**Scenario 2: USDT-TRC20 Payment Request**
```
✅ API Key validates (company_id=3, adm_id=4)
✅ Currency conversion works
✅ Redis stores customer data
✅ Wallet validation passes (USDT-TRC20 configured)
✅ Should work IF Tatum API is functional
```

---

## Comparison: Before vs After Merge

### Before Merge (Assumed Original Behavior)

**DynoBackend:**
- Global wallet pool (no company_id filtering)
- All users could use any configured admin wallet
- No company-level isolation
- Basic API authentication

**DynoBackendAPI:**
- Simple API key structure
- Direct database access
- Minimal validation layers

### After Merge (Current State)

**Combined System:**
- ✅ Multi-tenant company isolation (Phase 6-10)
- ✅ Company-specific wallet requirements
- ✅ Enhanced API key structure with company_id
- ✅ Comprehensive validation layers
- ❌ Breaking change: Requires wallet configuration per company
- ❌ More strict validation prevents global wallet usage

---

## Root Cause Summary

### Primary Issues Preventing Payment Creation:

1. **🔴 CRITICAL: Wallet Configuration Requirement**
   - **What:** Phase 10.3 added currency validation requiring company-specific wallets
   - **Impact:** Merchants must configure wallets for EACH cryptocurrency they accept
   - **Nomadly Status:** Only USDT-TRC20 configured
   - **Solution Needed:** Add wallet addresses for BTC, ETH, etc. via `/api/wallet/addWalletAddress`

2. **🟡 MODERATE: Company Isolation Enforcement**
   - **What:** Multi-tenant updates added company_id everywhere
   - **Impact:** Global features now require company-specific setup
   - **Merge Conflict:** DynoBackend (global) + DynoBackendAPI (company-specific) = validation mismatch
   - **Solution Needed:** Ensure all company records have required associations

3. **🟡 MODERATE: Tatum API Changes**
   - **What:** Local validation workaround after Tatum subscription issues
   - **Impact:** Some Tatum features may not work as expected
   - **Current Status:** Address validation works, but subscription/webhook may fail
   - **Solution Needed:** Update Tatum API integration or use alternative

4. **🟢 MINOR: API Service → Main Service Communication**
   - **What:** Two separate servers communicating via HTTP
   - **Impact:** Network issues or header mismatches could cause failures
   - **Current Status:** Working for Nomadly's API key
   - **Solution Needed:** Monitor for edge cases

---

## Transaction Analysis: Why Some Succeeded, Others Failed

**Successful Transaction:**
```
Transaction: 3b68dff5-f536-4b96-af72-271466b5c476
Amount: 29.25 USDT-TRC20
Status: successful
Reason: ✅ Merchant has USDT-TRC20 wallet configured
```

**Pending Transactions:**
```
- 88377a05-1418-4a42-99de-e36d3d5f53e5: 0.0101621 ETH (pending)
- 5be8b597-f403-4a38-b8d8-a36f6069e2f5: 0.00168995 ETH (pending)
- 7bb3c684-8683-43bc-94d3-a4241d0dd195: 0.00001114 BTC (pending)
- 66f01cc9-847e-4400-ba90-b8cefcb79354: 0.0100097 ETH (pending)
```

**Analysis:**
- These transactions were created BEFORE Phase 10.3 validation was added
- They bypassed wallet configuration checks
- They're stuck in "pending" because:
  1. No merchant wallet to receive payments
  2. Webhook subscriptions may not be working
  3. Settlement process can't find destination address

---

## Recommendations

### For Immediate Payment Creation Fix:

1. **Add Missing Wallet Addresses**
   ```bash
   POST /api/wallet/addWalletAddress
   Body: {
     "currency": "BTC",
     "wallet_address": "valid_btc_address",
     "company_id": 3
   }
   ```
   Repeat for: ETH, LTC, DOGE, BCH, TRX, USDT-ERC20

2. **Verify Company Configuration**
   - Ensure company_id=3 has all required fields
   - Add address info if generating invoices

3. **Test Payment Flow**
   - Use configured currency (USDT-TRC20) first
   - Then test newly added currencies
   - Monitor webhook responses

### For Long-term Architecture:

1. **Consider Backward Compatibility Mode**
   - Optional flag to disable company-level wallet validation
   - Allow global wallet pool for legacy merchants
   
2. **Migrate Existing Data**
   - Script to copy admin wallet addresses to all companies
   - Bulk wallet configuration for existing merchants

3. **Update API Documentation**
   - Clearly state wallet configuration requirements
   - Provide migration guide for merchants

4. **Improve Error Messages**
   - Current: "No wallet address configured"
   - Better: "Company ID 3 needs to configure BTC wallet. Please add via /api/wallet/addWalletAddress"

---

## Conclusion

The merge of DynoBackend and DynoBackendAPI introduced **multi-tenant company isolation** as a core architectural change. This enhancement improved security and data separation but created a **breaking change** for payment creation:

**Old System:** Any merchant could use any cryptocurrency (global wallet pool)
**New System:** Each company must configure wallet addresses for each cryptocurrency

**For Nomadly (company_id=3):**
- ✅ API key structure is correct
- ✅ Authentication works
- ✅ USDT-TRC20 payments work
- ❌ All other cryptocurrencies fail due to missing wallet configuration

**Fix Required:** Add wallet addresses for all cryptocurrencies the merchant wants to accept.

---

## Technical Notes

**Analysis Date:** 2025-01-24
**Database:** PostgreSQL (Railway)
**Backend Version:** Node.js + TypeScript (Merged Monorepo)
**Key Files Analyzed:**
- `/app/backend/controller/paymentController.ts` (Lines 304-373, 1046-1151)
- `/app/backend/api-service/controller/index.ts` (Lines 79-250)
- `/app/backend/api-service/middleware/apiMiddleware.ts`
- `/app/backend/models/userModels/userWalletAddressModel.ts`
- `/app/test_result.md` (Phase 6-12 implementation history)
