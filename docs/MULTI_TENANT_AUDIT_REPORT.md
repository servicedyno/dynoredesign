# Multi-Tenant Architecture Audit Report
**Date:** January 24, 2026  
**Scope:** Complete codebase analysis for company_id consistency

---

## 🎯 Executive Summary

### Issues Found
1. **Critical**: Dashboard queries missing company_id filters
2. **Medium**: User transactions missing company_id field
3. **Low**: Company creation endpoint validation message issue
4. **Info**: Several models don't need company_id (by design)

### Overall Status
⚠️ **PARTIALLY CONSISTENT** - Critical isolation works, but dashboard aggregations need company filtering

---

## 🔴 CRITICAL ISSUES

### 1. Dashboard Queries Missing company_id Filtering

**File:** `/app/backend/controller/dashboardController.ts`

**Issue:** SQL queries don't filter by company_id even when it's provided in query params

**Lines Affected:**
- Lines 72-82: Current month transactions query
- Lines 85-96: Last month transactions query  
- Lines 99-108: All-time transactions query
- Lines 111-121: Active wallets query
- Lines 124-133: Pending transactions query

**Current Code:**
```sql
SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as volume
FROM tbl_user_transaction 
WHERE user_id = :userId 
AND status = 'done'
AND "createdAt" >= :startOfMonth
```

**Problem:**
- Query accepts `company_id` from `req.query` (line 56)
- Sets up `baseWhere` object with company_id (line 67-69)
- **BUT NEVER USES IT IN SQL QUERIES**
- Results aggregate ALL companies' data regardless of filter

**Impact:**
- Dashboard shows mixed data from all companies
- Users with multiple companies can't see per-company stats
- Fee tiers calculated on combined volume (incorrect for multi-company users)
- Active wallets and pending transactions not company-scoped

**Fix Required:**
```sql
-- Add company_id join and filter
SELECT COUNT(*) as count, COALESCE(SUM(base_amount), 0) as volume
FROM tbl_user_transaction ut
LEFT JOIN tbl_customer c ON ut.customer_id = c.customer_id
WHERE ut.user_id = :userId 
AND ut.status = 'done'
AND ut."createdAt" >= :startOfMonth
${company_id ? 'AND c.company_id = :company_id' : ''}
```

---

### 2. Chart Data Queries Missing company_id

**File:** `/app/backend/controller/dashboardController.ts`

**Lines Affected:**
- Line 231: Main chart query
- Line 282: Currency breakdown query
- Line 304: Status breakdown query

**Same Issue:** Queries don't filter by company_id even though parameter is accepted

---

## 🟡 MEDIUM ISSUES

### 3. User Transactions Table Missing company_id

**File:** `/app/backend/models/userModels/userTransactionModel.ts`

**Issue:** `tbl_user_transaction` doesn't have `company_id` column

**Current Schema:**
```typescript
{
  transaction_id, wallet_id, user_id, payment_mode,
  base_amount, base_currency, transaction_reference,
  transaction_details, transaction_type, status, customer_id
}
```

**Problem:**
- Transactions are linked to customers
- Customers have company_id
- But transactions don't have direct company_id link
- Requires JOIN to filter by company

**Why This Matters:**
- Performance: Need JOIN instead of direct WHERE clause
- Complexity: Every query must join customer table
- Data integrity: If customer deleted (CASCADE), can't tell which company transaction belonged to

**Recommendation:**
Add `company_id` to `tbl_user_transaction` for denormalization:
```typescript
company_id: {
  type: DataTypes.INTEGER,
  allowNull: true,  // Some transactions might not have company context
  references: {
    model: "tbl_company",
    key: "company_id",
  },
  onUpdate: "CASCADE",
  onDelete: "SET NULL",
}
```

**Benefit:**
- Direct filtering: `WHERE company_id = X`
- Better performance (no JOIN needed)
- Data preservation if customer deleted

---

### 4. Customer Transactions Table Status

**File:** `/app/backend/models/customerModels/customerTransactionModel.ts`

**Status:** Need to verify if this has company_id

Let me check:
