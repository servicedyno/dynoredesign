# Phase 10: Payment Links Company Isolation Fix

## 🎯 Objective
Complete the multi-tenant company isolation by adding `company_id` support to payment links, ensuring consistency with the existing company-based architecture.

---

## 📋 Changes Implemented

### 1. Database Model Update
**File:** `/app/backend/models/userModels/paymentLinkModel.ts`

**Added Field:**
```typescript
company_id: {
  type: DataTypes.INTEGER,
  allowNull: true,
  references: {
    model: "tbl_company",
    key: "company_id",
  },
  onUpdate: "CASCADE",
  onDelete: "SET NULL",
}
```

**Impact:** Payment links can now be associated with specific companies, enabling multi-company isolation.

---

### 2. Create Payment Link Enhancement
**File:** `/app/backend/controller/paymentController.ts` - `createPaymentLink()`

**Changes:**
- ✅ Accept optional `company_id` in request body
- ✅ Validate company ownership before creating link
- ✅ Store `company_id` in database
- ✅ Include `company_id` in Redis payload

**Validation Logic:**
```javascript
if (company_id) {
  const companyExists = await companyModel.findOne({
    where: {
      company_id,
      user_id: userData.user_id,
    },
  });
  
  if (!companyExists) {
    return errorResponseHelper(res, 400,
      "Invalid company_id or company does not belong to this user"
    );
  }
}
```

**Request Body Example:**
```json
{
  "email": "customer@example.com",
  "base_currency": "USD",
  "modes": ["crypto", "card"],
  "amount": 100,
  "description": "Product purchase",
  "expire": "7d",
  "company_id": 1,  // ← NEW: Optional company_id
  "callback_url": "https://example.com/callback",
  "redirect_url": "https://example.com/success",
  "webhook_url": "https://example.com/webhook"
}
```

---

### 3. Get Payment Links Enhancement
**File:** `/app/backend/controller/paymentController.ts` - `getPaymentLinks()`

**Changes:**
- ✅ Accept optional `company_id` query parameter for filtering
- ✅ Return `company_id` in response for each link

**Query Parameter:**
```
GET /api/pay/getPaymentLinks?company_id=1
```

**Response Enhancement:**
```json
{
  "status": 200,
  "data": [
    {
      "link_id": 123,
      "company_id": 1,  // ← NEW: Company ID in response
      "description": "Product purchase",
      "base_amount": 100,
      ...
    }
  ]
}
```

---

### 4. Get Payment Link by ID Enhancement
**File:** `/app/backend/controller/paymentController.ts` - `getPaymentLinkById()`

**Changes:**
- ✅ Include `company_id` in response

**Response Enhancement:**
```json
{
  "status": 200,
  "data": {
    "link_id": 123,
    "company_id": 1,  // ← NEW: Company ID in response
    "transaction_id": "abc123",
    ...
  }
}
```

---

## 🔄 Complete Data Flow with Company Isolation

### API-Based Payment Flow (via API Key)
```
1. External API request with x-api-key header
2. apiMiddleware decrypts key → extracts company_id
3. createPayment stores in Redis:
   {
     company_id: 1,          // ← From decrypted API key
     adm_id: userData.user_id,
     customer_id: 123,
     ...
   }
4. createCryptoPayment validates:
   - Wallet exists for user_id + currency + company_id ✅
5. Payment processed with company context ✅
```

### Payment Link Flow (Direct User) - NOW FIXED
```
1. User creates payment link (JWT authenticated)
2. Optional company_id provided in request body
3. Validates company ownership
4. Stored in DB and Redis:
   {
     user_id: 5,
     company_id: 1,          // ← NOW INCLUDED
     transaction_id: "xyz789",
     pathType: "createLink",
     ...
   }
5. createCryptoPayment validates:
   - Wallet exists for user_id + currency + company_id ✅
6. Payment processed with company context ✅
```

---

## ✅ Benefits of This Fix

### 1. **Complete Multi-Tenancy**
- Users with multiple companies can now create company-specific payment links
- Each payment link is isolated to its company context

### 2. **Consistent Currency Validation**
- Task 10.3 validation now works correctly for BOTH:
  - ✅ API-based payments (company_id from API key)
  - ✅ Payment links (company_id from link data)

### 3. **Better Organization**
- Payment links can be filtered by company
- Frontend dashboards can display company-specific links
- Analytics and reporting are company-scoped

### 4. **Security Enhancement**
- Company-level wallet validation enforced for all payment types
- No cross-company payment processing possible
- Each company's payments are fully isolated

---

## 📊 Consistency Matrix (AFTER FIX)

| Aspect | API-Based Payments | Payment Links | Status |
|--------|-------------------|---------------|---------|
| API Key contains company_id | ✅ Yes | N/A | ✅ Consistent |
| Redis payload has company_id | ✅ Yes | ✅ Yes | ✅ **FIXED** |
| Wallet validation by company | ✅ Yes | ✅ Yes | ✅ **FIXED** |
| Currency validation by company | ✅ Yes | ✅ Yes | ✅ **FIXED** |
| Company isolation enforced | ✅ Yes | ✅ Yes | ✅ **FIXED** |

---

## 🗄️ Database Migration

**Required:** Add `company_id` column to `tbl_payment_link` table

### Automatic Migration
The Sequelize model will automatically add the column on next server start if you have auto-sync enabled.

### Manual Migration (Recommended for Production)
```sql
ALTER TABLE tbl_payment_link 
ADD COLUMN company_id INTEGER,
ADD CONSTRAINT fk_payment_link_company 
  FOREIGN KEY (company_id) 
  REFERENCES tbl_company(company_id) 
  ON UPDATE CASCADE 
  ON DELETE SET NULL;
```

---

## 🧪 Testing Scenarios

### Test Case 1: Create Payment Link with Company ID
```bash
curl -X POST https://your-domain.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "base_currency": "USD",
    "modes": ["crypto"],
    "amount": 50,
    "company_id": 1,
    "description": "Test payment with company"
  }'
```

**Expected:** Payment link created with `company_id: 1` in database and Redis.

### Test Case 2: Filter Payment Links by Company
```bash
curl -X GET "https://your-domain.com/api/pay/getPaymentLinks?company_id=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** Returns only payment links for `company_id: 1`.

### Test Case 3: Currency Validation with Company Context
```bash
# Create payment link with company_id=1
# User should have BTC wallet configured for company_id=1
# When customer pays with BTC, validation should pass

# If user doesn't have BTC wallet for company_id=1:
# Expected error: "No wallet address configured for BTC. Please add a BTC wallet first."
```

### Test Case 4: Backward Compatibility
```bash
# Create payment link WITHOUT company_id
curl -X POST https://your-domain.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "base_currency": "USD",
    "modes": ["crypto"],
    "amount": 50
  }'
```

**Expected:** Payment link created with `company_id: null` (backward compatible).

---

## 🔒 Security Considerations

### 1. Company Ownership Validation
- ✅ Creates payment link only if `company_id` belongs to authenticated user
- ✅ Prevents cross-company link creation

### 2. Read/Update/Delete Operations
- ✅ All operations validate `user_id` ownership
- ✅ Company context maintained throughout lifecycle

### 3. Payment Processing
- ✅ Wallet validation includes company context
- ✅ Currency availability checked per company
- ✅ No cross-company fund transfers possible

---

## 📝 API Documentation Updates Needed

### POST /api/pay/createPaymentLink
**New Optional Field:**
- `company_id` (integer, optional): Associate payment link with specific company

### GET /api/pay/getPaymentLinks
**New Query Parameter:**
- `company_id` (integer, optional): Filter links by company

**New Response Field:**
- `company_id` (integer|null): Company ID of the payment link

### GET /api/pay/links/:id
**New Response Field:**
- `company_id` (integer|null): Company ID of the payment link

---

## 🎓 Usage Guidelines

### For Users with Single Company
- `company_id` can be omitted in requests (backward compatible)
- System works as before

### For Users with Multiple Companies
- **Recommended:** Always provide `company_id` when creating payment links
- Filter payment links by company for better organization
- Ensure wallet addresses are configured per company

### For Frontend Implementation
```javascript
// Example: Create company-specific payment link
const createPaymentLink = async (companyId) => {
  const response = await fetch('/api/pay/createPaymentLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'customer@example.com',
      base_currency: 'USD',
      modes: ['crypto', 'card'],
      amount: 100,
      company_id: companyId,  // ← Include company context
      description: 'Product purchase'
    })
  });
  return response.json();
};

// Example: Filter links by company
const getCompanyLinks = async (companyId) => {
  const response = await fetch(
    `/api/pay/getPaymentLinks?company_id=${companyId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return response.json();
};
```

---

## ✅ Verification Checklist

- [x] Database model updated with `company_id` field
- [x] Create payment link accepts `company_id`
- [x] Company ownership validation implemented
- [x] Redis payload includes `company_id`
- [x] Get payment links supports `company_id` filtering
- [x] Response objects include `company_id`
- [x] Currency validation uses company context
- [x] Backward compatibility maintained
- [x] Security validations in place
- [ ] Database migration executed
- [ ] Integration tests passed
- [ ] API documentation updated
- [ ] Frontend integration completed

---

## 📅 Implementation Date
**Date:** January 24, 2026  
**Phase:** Phase 10 - Partial Wallet Configuration  
**Status:** ✅ Implementation Complete, Pending Testing

---

## 🔗 Related Files Modified
1. `/app/backend/models/userModels/paymentLinkModel.ts`
2. `/app/backend/controller/paymentController.ts`
   - `createPaymentLink()`
   - `getPaymentLinks()`
   - `getPaymentLinkById()`

---

## 📞 Support & Questions
For questions about this implementation, refer to:
- Phase 10 requirements in `/app/backend/DYNOPAY_IMPLEMENTATION_TASKS.txt`
- Company model: `/app/backend/models/companyModels/companyModel.ts`
- API key implementation: `/app/backend/controller/apiController.ts`
