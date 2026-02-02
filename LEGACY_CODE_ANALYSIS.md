# Legacy Code Analysis - DynoPay

## Summary
Total legacy items identified: **25+ issues across multiple categories**

---

## 🔴 CRITICAL - Security Vulnerabilities

### 1. SQL Injection Vulnerability
**File:** `/app/backend/controller/adminController.ts`
**Lines:** 266, 433, 439
```typescript
// VULNERABLE - String interpolation in SQL queries
`select * from tbl_admin where email='${email}' and password='${newPassword}'`
`update tbl_admin set password='${newPass}' where email='${adminData?.email}'`
```
**Fix:** Use parameterized queries or Sequelize ORM properly.

### 2. localStorage.json - OTP Storage in Plain File
**File:** `/app/backend/localStorage.json`
**Issue:** OTPs stored in a plain JSON file instead of Redis with TTL
```json
{"john@dyno.pt":{"otp":"681539","createdAt":"2026-01-31T01:46:43.417Z"}}
```
**Fix:** Move OTP storage to Redis with proper TTL expiration.

---

## 🟠 HIGH - Deprecated Libraries

### 3. `request` Library (Deprecated)
**File:** `/app/backend/api-service/helper/currencyConvert.ts`
```typescript
import request from "request";
// Uses callback-based API, deprecated since 2020
```
**Fix:** Replace with `axios` (already used in main backend).

### 4. Infobip SDK (Commented Out/Unused)
**File:** `/app/backend/utils/mailTransporter.ts`
```typescript
// import { Infobip, AuthType } from "@infobip-api/sdk";
```
**Fix:** Remove from package.json if not needed.

---

## 🟡 MEDIUM - Code Duplication

### 5. Duplicate Utility Files (api-service vs main backend)
| Main Backend | API Service | Status |
|--------------|-------------|--------|
| `/utils/constants.ts` | `/api-service/utils/constants.ts` | Different |
| `/utils/redisInstance.ts` | `/api-service/utils/redisInstance.ts` | Different |
| `/helper/currencyConvert.ts` | `/api-service/helper/currencyConvert.ts` | Different |
| `/utils/mailTransporter.ts` | `/api-service/utils/mailTransporter.ts` | Likely duplicate |
| `/utils/dbInstance.ts` | `/api-service/utils/dbInstance.ts` | Likely duplicate |

**Fix:** Create shared utilities package or import from main backend.

### 6. Separate API Service
**Files:** `/app/backend/api-service/*`
**Issue:** Complete separate Express application running on port 3301
- Duplicates models, helpers, middleware
- Could be merged into main backend as routes
**Fix:** Consider consolidating into single backend with route prefixes.

---

## 🟡 MEDIUM - Legacy Patterns

### 7. `var` Keyword Usage
**Files:**
- `/app/backend/apis/htxApi.ts` (lines 5, 9, 10, 12, 13)
- `/app/backend/migrate_john_user.js` (lines 193, 199)
```typescript
var pars = [];  // Should be: const pars = [];
```
**Fix:** Replace `var` with `const` or `let`.

### 8. HTX API with Legacy Signing
**File:** `/app/backend/apis/htxApi.ts`
```typescript
// Uses old signing pattern with console.log
console.log(meta);
console.log(`Signature: ${Signature}`);
```
**Fix:** Remove console.logs, modernize signing approach.

### 9. Deprecated Webhook Function
**File:** `/app/backend/controller/paymentController.ts` (line 3789)
```typescript
// DEPRECATED: Legacy callWebHook function - use callMerchantWebhook from webhooks/index.ts instead
```
**Fix:** Remove deprecated function completely.

### 10. Console.log Statements
**Count:** 1,327 console.log statements in backend
**Fix:** Replace with proper Winston logger (already available).

---

## 🔵 LOW - Cleanup Needed

### 11. Legacy Test/Debug Scripts in Backend Root
**Location:** `/app/backend/*.js` and `/app/backend/*.ts`
**Files (27+):**
```
add_usdt_fee_wallets.js
analyze_kms.js
analyze_nomadly.js
analyze_wallet_migration.js
analyze_xpub_encoding.js
check_kms_key_path.js
check_nomadly.js
check_nomadly_wallets.js
check_redis_alert.js
create_eth_payment_direct.js
create_usdt_payment_live.js
delete_redis_alert.js
diagnose_key_format.js
fix_google_key.js
investigate_orphaned_user.js
manual_process_payment.js
migrate_john_user.js
remove_usdt_fee_wallets.js
setup_btc_test.js
test_*.js (multiple)
check_*.ts (multiple)
fix_*.ts (multiple)
generate_*.ts (multiple)
manual_*.ts (multiple)
```
**Fix:** Move to `/app/backend/scripts/` folder or remove if no longer needed.

### 12. Legacy Python Test Files in Root
**Location:** `/app/*.py`
**Count:** 115 Python test files
**Examples:**
```
api_key_base_currency_test.py
authentication_system_test.py
backend_test.py
comprehensive_backend_test.py
...
```
**Fix:** Move to `/app/tests/` folder or create `/app/scripts/` for one-off scripts.

### 13. Documentation Files Accumulation
**Location:** `/app/*.md`
**Count:** 178 markdown files in root
**Examples:**
```
ADMIN_FEE_MULTI_TENANCY_ANALYSIS.md
API_CONSISTENCY_ANALYSIS.md
BELOW_THRESHOLD_PAYMENT_TEST.md
...
```
**Fix:** Consolidate into `/app/docs/` folder or remove outdated ones.

---

## 🔵 LOW - Potentially Unused Code

### 14. USDT Pool Models (Separate from Merchant Pool)
**Files:** `/app/backend/models/usdtPoolModels/`
**Issue:** Appears to be a separate pool system that may overlap with merchantPoolModels
**Fix:** Verify if this is legacy or actively used. If legacy, remove.

### 15. Flutterwave API Integration
**Files:** 
- `/app/backend/apis/flutterwaveApi.ts`
- Used in: webhooks, paymentController, walletController
**Status:** May be legacy if crypto-only payments are primary use case
**Fix:** Verify business need, remove if not used.

### 16. node-json-db for Local Storage
**File:** `/app/backend/api-service/utils/localStorage.ts`
```typescript
import { JsonDB, Config } from "node-json-db";
const localStorage = new JsonDB(new Config("localStorage", true, false, "/"));
```
**Fix:** Replace with Redis for proper distributed storage.

---

## 🔵 LOW - Raw SQL Queries

### 17. Raw SQL Instead of ORM
**Count:** 9 raw SQL queries found
**Issue:** Mixed usage of Sequelize ORM and raw queries
**Fix:** Standardize on Sequelize ORM methods where possible.

---

## Recommended Cleanup Priority

### Phase 1 - Security (Immediate)
1. Fix SQL injection in adminController.ts
2. Move OTP storage to Redis

### Phase 2 - Dependencies (High)
3. Remove/replace deprecated `request` library
4. Remove unused Infobip SDK from package.json

### Phase 3 - Code Quality (Medium)
5. Consolidate duplicate utility files
6. Replace `var` with `const/let`
7. Remove deprecated webhook function
8. Replace console.log with Winston logger

### Phase 4 - Cleanup (Low)
9. Move test scripts to proper folders
10. Consolidate documentation files
11. Evaluate USDT Pool vs Merchant Pool
12. Evaluate Flutterwave integration need

---

## Files to Delete (After Review)
```bash
# Backend debug/test scripts (after backup)
/app/backend/*.js (except package*.json)
/app/backend/check_*.ts
/app/backend/fix_*.ts
/app/backend/generate_*.ts
/app/backend/manual_*.ts
/app/backend/test_*.ts (except actual test files)
/app/backend/analyze_*.js
/app/backend/migrate_*.js

# Root test files (after backup)
/app/*.py (move to /app/tests/)

# Root documentation (consolidate)
/app/*.md (move to /app/docs/)
```

---

Generated: 2026-02-02
