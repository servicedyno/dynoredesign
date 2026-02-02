# Multi-Tenant (company_id) Consistency Analysis

## Overview
DynoPay operates as a multi-tenant system where each merchant can have multiple companies. 
The `company_id` field is critical for proper data isolation between companies.

## ✅ Fixes Applied

### 1. Swagger Documentation Updated

#### createPaymentLink - `/api/pay/createPaymentLink`
- **Before:** `company_id` marked as OPTIONAL
- **After:** `company_id` marked as ✅ REQUIRED
- Added to `required` array in schema

#### addApi - `/api/userApi/addApi`  
- **Before:** Only `api_name` required
- **After:** `company_id` and `base_currency` also REQUIRED
- Updated description with multi-tenant warning
- Updated examples to include required fields

#### getPaymentLinks - `/api/pay/getPaymentLinks`
- Added clear documentation explaining:
  - Omit `company_id` to get ALL companies data
  - Provide `company_id` to filter specific company

#### Notifications - `/api/notifications`
- Added clear documentation explaining multi-tenant filtering behavior

---

## Current API Behavior Summary

### ✅ Endpoints Requiring company_id (CREATE operations)
| Endpoint | Method | company_id | Status |
|----------|--------|------------|--------|
| `/api/pay/createPaymentLink` | POST | ✅ REQUIRED | Documented |
| `/api/userApi/addApi` | POST | ✅ REQUIRED | Documented |
| `/api/wallet/addWallet` | POST | ✅ REQUIRED | Documented |
| `/api/company/updateCompany/:id` | PUT | Via URL path | Protected |

### 📋 Endpoints with Optional company_id (LIST/READ operations)
| Endpoint | Method | Behavior without company_id |
|----------|--------|----------------------------|
| `/api/pay/getPaymentLinks` | GET | Returns ALL user's companies |
| `/api/dashboard` | GET | Aggregates ALL user's companies |
| `/api/dashboard/chart` | GET | Aggregates ALL user's companies |
| `/api/notifications` | GET | Returns ALL user's companies |
| `/api/wallet/getWallet` | GET | Returns ALL user's companies |
| `/api/userApi/getApi` | GET | Returns ALL user's companies |
| `/api/invoices` | GET | Returns ALL user's companies |

### 🔒 Endpoints Protected by companyOwnershipMiddleware
| Endpoint | Method | Protection |
|----------|--------|------------|
| `/api/company/getCompany/:id` | GET | Verifies user owns company |
| `/api/company/updateCompany/:id` | PUT | Verifies user owns company |
| `/api/company/deleteCompany/:id` | DELETE | Verifies user owns company |
| `/api/company/getTransactions/:id` | GET | Verifies user owns company |
| `/api/company/webhook-settings/:id` | GET/PUT | Verifies user owns company |

---

## Design Rationale

### Why company_id is OPTIONAL for LIST endpoints:
1. **User Experience**: Users can see aggregated data across all their companies
2. **Dashboard Views**: Default view shows complete business picture
3. **Backward Compatibility**: Existing integrations work without changes
4. **Flexibility**: Filtering is available when needed via query param

### Why company_id is REQUIRED for CREATE endpoints:
1. **Data Isolation**: Each record must belong to a specific company
2. **Audit Trail**: Clear ownership for compliance
3. **Billing Accuracy**: Fees and transactions tied to correct company
4. **Security**: Prevents accidental cross-company data creation

---

## API Integration Guide

### For Developers Integrating with DynoPay:

#### Single Company Setup
```javascript
// If you have one company, you can hardcode company_id
const API_CONFIG = {
  companyId: 1  // Your company ID
};

// All CREATE requests include company_id
await createPaymentLink({ amount: 100, company_id: API_CONFIG.companyId });
```

#### Multi-Company Setup
```javascript
// For multi-company, let user select or use context
const selectedCompanyId = getCurrentCompanyContext();

// CREATE requests - always include company_id
await createPaymentLink({ amount: 100, company_id: selectedCompanyId });

// LIST requests - filter by company or get all
await getPaymentLinks({ company_id: selectedCompanyId });  // Specific company
await getPaymentLinks({});  // All companies
```

#### Getting Your Company ID
```javascript
// Get all companies for the user
const companies = await getCompanies();
// Returns: [{ id: 1, name: "Company A" }, { id: 2, name: "Company B" }]

// Use company.id as company_id in subsequent requests
```

---

## Files Modified

1. `/app/backend/swagger/paths/payment.ts` - createPaymentLink, getPaymentLinks
2. `/app/backend/swagger/paths/apiKeys.ts` - addApi
3. `/app/backend/swagger/paths/notification.ts` - getNotifications

---

Generated: 2026-02-02
