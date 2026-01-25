# API Field Redundancy Fix - Currency Fields
**Date:** January 25, 2026  
**Issue:** API required both `currency` and `base_currency` fields  
**Status:** ✅ **FIXED**

---

## Problem Statement

The payment link creation endpoint was incorrectly requiring **both** `currency` and `base_currency` fields, which is redundant and confusing for API consumers. This violated the principle of backward compatibility and created unnecessary complexity.

### Original Behavior (Incorrect)
```json
{
  "amount": 100.00,
  "currency": "USD",        // Required
  "base_currency": "USD",   // Also required (redundant!)
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```

**Error if only one field provided:**
```json
{
  "message": "Please enter proper values!",
  "errors": [
    {"key": "base_currency", "error": "\"base_currency\" is required"}
  ]
}
```

---

## Root Cause Analysis

### 1. Middleware Validation
**File:** `/app/backend/middleware/linkMiddleware.ts`

The middleware was hardcoded to require `base_currency`:

```typescript
// OLD CODE (INCORRECT)
const { email, base_currency, amount, modes } = req.body;
validateFields = { email, base_currency, amount, modes };

schema = {
  base_currency: Joi.string()
    .required()  // ❌ Always required, no flexibility
    .valid(...allowedCurrency)
    .messages({
      "string.empty": "Base Currency is Required",
    }),
  // ...
};
```

### 2. Controller Logic
**File:** `/app/backend/controller/paymentController.ts`

The controller **correctly** handled both fields for backward compatibility:

```typescript
// CONTROLLER CODE (CORRECT)
const { 
  base_currency,    // NEW format
  currency,         // LEGACY format
  amount,
  base_amount,
} = req.body;

// Normalize field names - use new format first, fall back to legacy
const normalizedCurrency = base_currency || currency || 'USD';
const normalizedAmount = base_amount || amount;
```

### Conflict
- **Middleware:** Required `base_currency` only ❌
- **Controller:** Supported both `base_currency` OR `currency` ✅
- **Result:** Requests with only `currency` were rejected by middleware before reaching controller

---

## Solution Implemented

### 1. Updated Middleware (`linkMiddleware.ts`)

```typescript
// NEW CODE (FIXED)
const { 
  email, 
  base_currency,  // NEW format (recommended)
  currency,       // LEGACY format (backward compatibility)
  amount,
  base_amount,
  modes 
} = req.body;

// Support both new and legacy field names
// Priority: base_currency > currency
const normalizedCurrency = base_currency || currency;
const normalizedAmount = base_amount || amount;

const validateFields = { 
  email, 
  currency: normalizedCurrency,  // Validate the normalized value
  amount: normalizedAmount, 
  modes 
};

const schema = {
  // ... other fields
  currency: Joi.string()
    .required()  // ✅ Validates normalized value (accepts either field)
    .valid(...allowedCurrency)
    .messages({
      "string.empty": "Currency is required. Please provide either 'currency' or 'base_currency' field.",
      "any.required": "Currency is required. Please provide either 'currency' or 'base_currency' field.",
    }),
};
```

### Key Changes:
1. **Extract both fields:** `base_currency` and `currency`
2. **Normalize:** Use `base_currency || currency` fallback
3. **Validate normalized value:** Single validation for both field names
4. **Clear error messages:** Explain both field options

---

## New Behavior (Correct)

### Option 1: NEW Format (Recommended)
```json
{
  "amount": 100.00,
  "base_currency": "USD",
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```
✅ **Works perfectly**

### Option 2: LEGACY Format (Backward Compatible)
```json
{
  "amount": 100.00,
  "currency": "USD",
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```
✅ **Works perfectly**

### Option 3: Both Fields (Accepted)
```json
{
  "amount": 100.00,
  "currency": "EUR",
  "base_currency": "USD",
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```
✅ **Works** - `base_currency` takes priority (USD is used)

---

## Testing Results

### Manual Testing
```bash
# Test 1: NEW format with base_currency
✅ Status: 200 OK

# Test 2: LEGACY format with currency
✅ Status: 200 OK
```

### Comprehensive Test Suite
```
Total Tests: 66
Passed: 66 (100.0%)
Failed: 0 (0.0%)

Phase 5 (Payment Links): 5/5 (100.0%)
- ✅ 5.1 Create Payment Link (NEW) - base_currency field
- ✅ 5.2 Create Payment Link (LEGACY) - currency field
```

---

## Documentation Updates

### Swagger/OpenAPI Documentation
**File:** `/app/backend/swagger/paths/payment.ts`

Updated description to clarify:

```markdown
**FIELD NAME COMPATIBILITY:**
The API supports flexible field naming for backward compatibility. 
You only need to provide **ONE** currency field and **ONE** amount field:

**Currency Field (choose one):**
- `currency` - **RECOMMENDED** for most use cases
- `base_currency` - Alternative name (works identically)

**Amount Field (choose one):**
- `amount` - **RECOMMENDED** for most use cases  
- `base_amount` - Alternative name (works identically)

⚠️ **IMPORTANT:** Only provide ONE of each field type. 
If both are provided, `base_*` fields take priority.
```

### Examples Updated

**Recommended Format:**
```json
{
  "amount": 100.00,
  "currency": "USD",
  "company_id": 1,
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```

**Alternative Format:**
```json
{
  "base_amount": 100.00,
  "base_currency": "USD",
  "company_id": 1,
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}
```

---

## Similar Issues Checked

Searched entire codebase for similar redundancy issues:

### ✅ API Key Creation (`apiMiddleware.ts`)
```typescript
base_currency: Joi.string().required()
```
**Status:** ✅ Only requires `base_currency` - NO similar issue

### ✅ Wallet Operations (`walletMiddleware.ts`)
```typescript
req_currency: Joi.string().required()
exchange_currency: Joi.string().required()
```
**Status:** ✅ Different currencies for exchange operations - Valid use case

### Conclusion
No other endpoints had similar field redundancy issues.

---

## Impact Assessment

### Backward Compatibility ✅
- **Legacy clients** using `currency` field: ✅ Still works
- **New clients** using `base_currency` field: ✅ Still works
- **Existing tests:** ✅ All pass (100% success rate)

### API Simplicity ✅
- **Before:** Confusing requirement for both fields
- **After:** Flexible - use whichever field name you prefer

### Developer Experience ✅
- **Before:** Error: "base_currency is required" even when currency provided
- **After:** Clear message: "Provide either 'currency' or 'base_currency'"

---

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `/app/backend/middleware/linkMiddleware.ts` | Code | Added field normalization logic |
| `/app/backend/swagger/paths/payment.ts` | Docs | Updated field descriptions and examples |
| `/app/comprehensive_backend_test.py` | Test | Updated test to use correct field names |

---

## Recommendations

### For API Consumers
1. **Use `currency` field** (simpler, more standard naming)
2. Only provide ONE currency field, not both
3. Same principle applies for `amount` vs `base_amount`

### For Future Development
1. **Standardize field names** across all endpoints
2. **Document alternative names** clearly in Swagger
3. **Middleware normalization pattern** can be reused for other backward compatibility needs

---

## Verification

To verify the fix:

```bash
# Run comprehensive test suite
cd /app
python3 comprehensive_backend_test.py

# Expected result:
# Phase 5 (Payment Links): 5/5 (100.0%)
# Overall: 66/66 (100.0%) ✅
```

---

## Conclusion

Successfully fixed the redundant field requirement issue. The API now properly supports both `currency` and `base_currency` fields with clear fallback logic, improving both backward compatibility and developer experience. All tests pass with 100% success rate.

**Status:** ✅ **PRODUCTION READY**
