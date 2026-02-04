# Repository Merge Analysis & Issue Detection

## Executive Summary

This document identifies issues from merging **DynoBackend** (main transaction processing) and **DynoBackendAPI** (merchant API service) into a single monorepo.

---

## Repository Architecture Analysis

### Original Repositories (Inferred)

#### DynoBackend (Main Service)
**Primary Purpose:** Transaction processing, wallet management, user authentication
**Port:** 8001 (now 3300 internal)
**Key Components:**
- User/Company management
- Wallet address generation
- Transaction processing
- Payment confirmation
- Dashboard APIs
- Notification system
- Invoice generation

#### DynoBackendAPI (API Service)  
**Primary Purpose:** External API for merchant integrations
**Port:** 3301
**Key Components:**
- API key authentication
- Customer management (tbl_customer)
- Payment creation delegation
- Simplified merchant-facing endpoints

### Current Merged Architecture

```
Client Request
    ↓
Python Proxy (8001) → Node.js Main Backend (3300) → PostgreSQL/Redis
                           ↓
                    API Service (3301)
                           ↓
                    Calls back to Main (3300)
```

---

## Critical Issues Identified

### 🔴 ISSUE #1: API Service Using External SERVER_URL

**Location:** `/app/backend/api-service/controller/index.ts`

**Problem:**
API service makes internal calls to the main backend using `process.env.SERVER_URL`, which points to the external preview URL instead of local backend.

**Code:**
```typescript
// Line 177 - cryptoPayment function
const currencyData = await axios.post(
  process.env.SERVER_URL + "/api/pay/getCurrencyRates",  // ❌ External URL
  { source: data.base_currency, amount: amount, ... }
);

// Line 226 - cryptoPayment function  
await axios.post(
  process.env.SERVER_URL + "/api/pay/createCryptoPayment",  // ❌ External URL
  payload,
  { headers: { Authorization: req.headers.authorization } }
);

// Line 270 - getCryptoTransaction function
await axios.post(
  process.env.SERVER_URL + "/api/pay/verifyCryptoPayment",  // ❌ External URL
  { address },
  { headers: { Authorization: req.headers.authorization } }
);
```

**Current Value:**
```env
SERVER_URL=https://anomaly-finder-10.preview.emergentagent.com
```

**Impact:**
- API service can't reach internal backend endpoints
- Causes 404/503 errors
- Prevents payment creation via API
- Network latency for internal calls
- Potential security issues (external calls for internal operations)

**Root Cause:**
In the original repos, they likely ran on the same domain or had proper service discovery. After merge, they need to use internal networking.

---

### 🔴 ISSUE #2: Missing Authentication for Currency Conversion

**Location:** `/app/backend/routes/paymentRouter.ts:49-51`

**Problem:**
`/api/pay/getCurrencyRates` endpoint requires `customerAuthMiddleware`, but API service calls it without proper customer authentication.

**Code:**
```typescript
// paymentRouter.ts
paymentRouter.post(
  "/getCurrencyRates",
  customerAuthMiddleware,  // ❌ Requires customer JWT
  paymentController.getCurrencyRates
);
```

**API Service Call:**
```typescript
// Passes Authorization header from API request
// But this might be API key, not customer JWT
headers: { Authorization: req.headers.authorization }
```

**Impact:**
- 403 Unauthorized errors
- Payment creation fails at currency conversion step
- API service can't complete payment flow

**Original Repos:**
- DynoBackendAPI might have had direct database access to currency rates
- Or used a different authentication mechanism
- Merge introduced middleware mismatch

---

### 🟡 ISSUE #3: Duplicate getCurrencyRates Endpoints

**Location:** Multiple routes

**Problem:**
Two different routers have the same endpoint:

```typescript
// /app/backend/routes/paymentRouter.ts:49
paymentRouter.post("/getCurrencyRates", customerAuthMiddleware, paymentController.getCurrencyRates);

// /app/backend/routes/walletRouter.ts:41  
walletRouter.post("/getCurrencyRates", walletController.getCurrencyRates);
```

**Routes:**
- `/api/pay/getCurrencyRates` (requires customerAuthMiddleware)
- `/api/wallet/getCurrencyRates` (requires authMiddleware)

**Impact:**
- Confusing API surface
- Different authentication requirements
- API service might call the wrong endpoint
- Potential for inconsistent behavior

**Likely Origin:**
- DynoBackend had `/api/wallet/getCurrencyRates`
- DynoBackendAPI expected `/api/pay/getCurrencyRates`
- Both were merged without consolidation

---

### 🟡 ISSUE #4: Port Configuration Mismatch

**Problem:**
Services need to communicate internally but don't have proper configuration.

**Current Setup:**
```env
PORT=8001                    # Python proxy
API_SERVICE_PORT=3301        # API service
# Node.js main backend uses: 3300 (hardcoded in server.py)
```

**Missing:**
```env
INTERNAL_BACKEND_URL=http://localhost:3300  # For API service internal calls
```

**Impact:**
- API service can't discover main backend
- Hardcoded port assumptions
- Difficult to scale or change ports

---

### 🟢 ISSUE #5: Customer vs User Authentication Mismatch

**Problem:**
Two authentication systems that don't integrate well:

**Main Backend (DynoBackend):**
- User authentication (tbl_user)
- JWT tokens for users
- `authMiddleware` validates user tokens

**API Service (DynoBackendAPI):**
- Customer authentication (tbl_customer)
- Separate JWT tokens for customers  
- `customerAuthMiddleware` validates customer tokens

**Integration Issue:**
When API service calls main backend, it passes customer JWT, but main backend expects user JWT.

**Code Evidence:**
```typescript
// API service creates customer token
const token = jwt.sign(userData, tokenSecret);

// Main backend expects user token from authMiddleware
// Mismatch causes authentication failures
```

---

### 🟢 ISSUE #6: Redis Key Collision Potential

**Problem:**
Both repos use Redis with potentially overlapping key patterns.

**API Service:**
```typescript
await setRedisItem("customer-" + transactionId, redisPayload);
```

**Main Backend:**
```typescript
await setRedisItem("customer-" + data.uniqueRef, items);
await setRedisItem("crypto-" + address, paymentData);
```

**Potential Collision:**
If both services use the same Redis instance with similar key patterns, data could be overwritten or misinterpreted.

---

## Secondary Issues

### 🟡 ISSUE #7: Different Error Response Formats

**API Service:**
```typescript
errorResponseHelper(res, 503, "Account Already Exists!!!");
```

**Main Backend:**
```typescript
return errorResponseHelper(res, 400, 
  `No wallet address configured for ${requestedCurrency}. 
   Please add a ${requestedCurrency} wallet first.`
);
```

While both use `errorResponseHelper`, the status codes and message formats differ, potentially confusing API consumers.

---

### 🟡 ISSUE #8: Meta_data Validation Inconsistency

**API Service Validation:**
```typescript
// Requires product_name or product in meta_data
meta_data: {
  product_name: 'Test Product',  // Required
  order_id: 'TEST-ORDER-...'
}
```

**Main Backend:**
Doesn't enforce same validation, leading to confusion about what fields are required.

---

### 🟢 ISSUE #9: Database Model Duplication

Both services have their own models for shared entities:

**API Service:**
- `/app/backend/api-service/models/customerModel.ts`
- `/app/backend/api-service/models/customerWalletModel.ts`

**Main Backend:**
- `/app/backend/models/` (various models)

If schema changes in one place, the other might not reflect it.

---

### 🟢 ISSUE #10: No Service Health Checks

Neither service has health check endpoints that verify:
- Database connectivity
- Redis connectivity
- Inter-service communication
- External API availability (Tatum, etc.)

This makes debugging difficult.

---

## Fix Priority

### P0 - Critical (Blocks Core Functionality)
1. ✅ Fix SERVER_URL for internal calls (Issue #1)
2. ✅ Fix authentication for getCurrencyRates (Issue #2)
3. ✅ Add INTERNAL_BACKEND_URL configuration (Issue #4)

### P1 - High (Causes Errors)
4. ✅ Consolidate getCurrencyRates endpoints (Issue #3)
5. ⚠️ Bridge customer/user authentication (Issue #5)

### P2 - Medium (Quality of Life)
6. Document API response formats (Issue #7)
7. Standardize meta_data validation (Issue #8)
8. Add service health checks (Issue #10)

### P3 - Low (Technical Debt)
9. Consolidate database models (Issue #9)
10. Implement Redis namespace strategy (Issue #6)

---

## Detailed Solutions

### Solution #1: Create Internal Backend URL Configuration

**File:** `/app/backend/.env`

**Add:**
```env
# Internal service communication (for API service to call main backend)
INTERNAL_BACKEND_URL=http://localhost:3300
```

**Update API Service Controller:**
```typescript
// Use internal URL for service-to-service calls
const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || 'http://localhost:3300';

const currencyData = await axios.post(
  BACKEND_URL + "/api/pay/getCurrencyRates",
  ...
);
```

---

### Solution #2: Create Public Currency Rates Endpoint

**Problem:** getCurrencyRates requires authentication, but it's a utility function.

**Solution:** Create a non-authenticated version for internal use.

**File:** `/app/backend/routes/paymentRouter.ts`

**Add:**
```typescript
// Public endpoint for internal service calls
paymentRouter.post(
  "/getCurrencyRatesPublic",
  paymentController.getCurrencyRates
);

// Or use API key authentication for service-to-service
paymentRouter.post(
  "/getCurrencyRatesInternal",
  internalServiceMiddleware,
  paymentController.getCurrencyRates
);
```

---

### Solution #3: Bridge Authentication

**Create middleware to handle both auth types:**

**File:** `/app/backend/middleware/bridgeAuthMiddleware.ts`

```typescript
export const bridgeAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return errorResponseHelper(res, 403, "Authorization required");
    }

    const decoded = jwt.decode(token);
    
    // Check if it's a customer token (from API service)
    if (decoded.customer_id || decoded.customer_name) {
      res.locals.customerData = decoded;
      res.locals.isCustomer = true;
    } 
    // Check if it's a user token (from main backend)
    else if (decoded.user_id || decoded.email) {
      res.locals.userData = decoded;
      res.locals.isCustomer = false;
    }
    
    next();
  } catch (error) {
    errorResponseHelper(res, 403, "Invalid authorization");
  }
};
```

---

## Implementation Plan

### Phase 1: Immediate Fixes (P0)
1. Add INTERNAL_BACKEND_URL to .env
2. Update API service controller to use internal URL
3. Test payment creation flow
4. Document changes

### Phase 2: Authentication Fix (P1)
1. Create bridge authentication middleware
2. Update getCurrencyRates to accept both auth types
3. Test API service → Main backend flow
4. Update API documentation

### Phase 3: Cleanup (P2-P3)
1. Consolidate duplicate endpoints
2. Standardize error responses
3. Add health check endpoints
4. Document service architecture

---

## Testing Checklist

After implementing fixes:

- [ ] API service can create customer
- [ ] API service can call getCurrencyRates successfully
- [ ] API service can create crypto payment
- [ ] Payment address generated correctly
- [ ] Transaction stored in database
- [ ] QR code returned to customer
- [ ] Webhook subscription created
- [ ] No 404/403/500 errors in logs

---

## Conclusion

The merge of DynoBackend and DynoBackendAPI introduced **service communication issues** rather than logic problems. The core functionality of both repos is intact, but they need proper configuration to communicate internally.

**Key Takeaway:**
The repos were designed to run independently or with external service discovery. The merge requires:
1. Internal networking configuration
2. Authentication bridge for service-to-service calls
3. Consistent endpoint routing

These are **configuration issues**, not architectural flaws. With the fixes above, the merged system will work correctly.
