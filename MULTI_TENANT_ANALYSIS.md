# Multi-Tenant (company_id) Consistency Analysis

## Overview
DynoPay operates as a multi-tenant system where each merchant can have multiple companies. 
The `company_id` field is critical for proper data isolation between companies.

## Current State Analysis

### ✅ Properly Protected Endpoints (company_id validated)
| Endpoint | Method | Middleware | Status |
|----------|--------|------------|--------|
| `/api/company/getCompany/:id` | GET | companyOwnershipMiddleware | ✅ |
| `/api/company/updateCompany/:id` | PUT | companyOwnershipMiddleware | ✅ |
| `/api/company/deleteCompany/:id` | DELETE | companyOwnershipMiddleware | ✅ |
| `/api/company/getTransactions/:id` | GET | companyOwnershipMiddleware | ✅ |
| `/api/company/webhook-settings/:id` | GET/PUT | companyOwnershipMiddleware | ✅ |
| `/api/company/webhook-test/:id` | POST | companyOwnershipMiddleware | ✅ |
| `/api/company/webhook-history/:id` | GET | companyOwnershipMiddleware | ✅ |
| `/api/pay/createPaymentLink` | POST | Code validates company_id | ✅ |

### ⚠️ Endpoints with Optional company_id (Filter Only)
These endpoints accept company_id as an optional filter but don't require it:

| Endpoint | Method | Issue |
|----------|--------|-------|
| `/api/pay/getPaymentLinks` | GET | company_id optional filter |
| `/api/dashboard` | GET | company_id optional filter |
| `/api/dashboard/chart` | GET | company_id optional filter |
| `/api/dashboard/recent-transactions` | GET | company_id optional filter |
| `/api/notifications` | GET | company_id optional filter |
| `/api/wallet/getWallet` | GET | company_id optional filter |
| `/api/wallet/getWalletAddresses` | GET | company_id optional filter |
| `/api/userApi/getApi` | GET | company_id optional filter |
| `/api/invoices` | GET | company_id optional filter |

### 📋 Design Decision
The current design is **INTENTIONAL** for these reasons:
1. **User-level access**: A user owns multiple companies
2. **Aggregated views**: Dashboard shows data across ALL user's companies by default
3. **Optional filtering**: `company_id` query param allows filtering to specific company
4. **Backward compatibility**: Existing integrations work without company_id

### ⚠️ Documentation Inconsistency Found

**File:** `/app/backend/swagger/paths/payment.ts`
**Issue:** createPaymentLink documentation says company_id is "OPTIONAL" but code REQUIRES it

```typescript
// DOCUMENTATION (INCORRECT):
company_id: { 
  type: 'integer', 
  description: '📝 OPTIONAL: Company ID...'
}

// ACTUAL CODE (CORRECT):
if (!company_id) {
  return res.status(400).json({
    message: "company_id is required..."
  });
}
```

## Fixes Required

### 1. Update Swagger Documentation
Mark company_id as REQUIRED for:
- `POST /api/pay/createPaymentLink`
- `POST /api/userApi/addApi`

### 2. Document Optional company_id Behavior
Clarify in docs that company_id is optional for LIST endpoints:
- Returns ALL user's companies data if omitted
- Filters to specific company if provided

### 3. Add company_id to Response Objects
Ensure all responses include company_id for client-side filtering.

---
Generated: 2026-02-02
