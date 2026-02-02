# Legacy Code Analysis - DynoPay

## Summary
**Original Issues:** 25+ legacy items across multiple categories
**Fixed:** ✅ 15 issues resolved
**Deferred:** Flutterwave integration (to be improved later)

---

## ✅ FIXED Issues

### 🔴 CRITICAL - Security Vulnerabilities

#### 1. SQL Injection Vulnerability - ✅ FIXED
**File:** `/app/backend/controller/adminController.ts`
**Fix Applied:** Replaced string interpolation with parameterized queries using Sequelize replacements
```typescript
// Before (VULNERABLE):
`select * from tbl_admin where email='${email}' and password='${newPassword}'`

// After (SECURE):
sequelize.query(
  `SELECT * FROM tbl_admin WHERE email = :email AND password = :password`,
  { replacements: { email, password: hashedPassword }, type: QueryTypes.SELECT }
);
```

#### 2. localStorage.json - OTP Storage in Plain File - ✅ FIXED
**Files:** 
- `/app/backend/controller/userController.ts`
- `/app/backend/utils/localStorage.ts`
**Fix Applied:** OTP storage moved to Redis with 10-minute TTL
```typescript
// OTP now stored in Redis with automatic expiration
const otpKey = `otp:${email}`;
await setRedisItem(otpKey, { otp, createdAt });
await setRedisTTL(otpKey, 600); // 10 minutes
```

---

### 🟠 HIGH - Deprecated Libraries

#### 3. `request` Library (Deprecated) - ✅ FIXED
**File:** `/app/backend/api-service/helper/currencyConvert.ts`
**Fix Applied:** Replaced with `axios`

#### 4. Infobip SDK (Unused) - ✅ FIXED
**File:** `/app/backend/package.json`
**Fix Applied:** Removed `@infobip-api/sdk` from dependencies

#### 5. Other Removed Dependencies - ✅ FIXED
- Removed `request` package
- Removed `@types/request`
- Removed `body-parser` (built into Express)
- Removed `node-json-db` (OTP moved to Redis)

---

### 🟡 MEDIUM - Legacy Patterns

#### 6. `var` Keyword Usage - ✅ FIXED
**File:** `/app/backend/apis/htxApi.ts`
**Fix Applied:** Replaced all `var` with `const`, removed debug console.logs

#### 7. Deprecated Webhook Function - ✅ FIXED
**File:** `/app/backend/controller/paymentController.ts`
**Fix Applied:** Removed deprecated `callWebHook` function comments

#### 8. Commented-out Infobip Code - ✅ FIXED
**File:** `/app/backend/utils/mailTransporter.ts`
**Fix Applied:** Cleaned up commented legacy code

---

### 🔵 LOW - File Organization

#### 9. Backend Debug/Test Scripts - ✅ FIXED
**Action:** Moved 27+ scripts to organized folders:
```
/app/backend/scripts/
├── analysis/    # Analysis scripts (analyze_*.js)
├── debug/       # Debug/check scripts (check_*.ts, test_*.js)
└── migration/   # Migration scripts (migrate_*.js, fix_*.ts)
```

#### 10. Python Test Files - ✅ FIXED
**Action:** Moved 115 Python test files to `/app/tests/python/`

#### 11. Documentation Files - ✅ FIXED
**Action:** Moved 178 markdown files to `/app/docs/`
**Kept in root:** README.md, test_result.md, LEGACY_CODE_ANALYSIS.md

#### 12. localStorage.ts Files - ✅ FIXED
**Files:** 
- `/app/backend/utils/localStorage.ts`
- `/app/backend/api-service/utils/localStorage.ts`
**Action:** Marked as deprecated with warning messages

---

## ⏸️ DEFERRED Issues

### Flutterwave Integration
**Status:** Deferred for later improvement
**Files:** 
- `/app/backend/apis/flutterwaveApi.ts`
- References in paymentController.ts, walletController.ts
**Reason:** User requested to improve later

---

## 📋 Remaining Items (Low Priority)

### 1. Console.log Statements
**Count:** ~1,327 statements
**Status:** Should be replaced with Winston logger gradually
**Note:** Not blocking - logging helps with debugging

### 2. Code Duplication (api-service vs main backend)
**Status:** Low priority - both services work correctly
**Note:** Could be consolidated in future refactoring

### 3. USDT Pool Models
**Files:** `/app/backend/models/usdtPoolModels/`
**Status:** Need business verification if still used
**Note:** May overlap with merchantPoolModels

### 4. Raw SQL Queries
**Count:** 9 queries (excluding fixed admin queries)
**Status:** Low priority - Sequelize ORM used for most queries

---

## File Structure After Cleanup

```
/app/
├── README.md
├── test_result.md
├── LEGACY_CODE_ANALYSIS.md
├── docs/                     # 178 documentation files
├── tests/
│   └── python/              # 115 Python test files
├── backend/
│   ├── server.ts            # Main server (only TS in root)
│   ├── scripts/
│   │   ├── analysis/        # Analysis scripts
│   │   ├── debug/           # Debug/check scripts
│   │   └── migration/       # Migration scripts
│   └── ...
└── frontend/
    └── ...
```

---

## Security Improvements Summary

| Issue | Severity | Status |
|-------|----------|--------|
| SQL Injection in adminController | CRITICAL | ✅ Fixed |
| OTP stored in plain file | HIGH | ✅ Fixed (Redis) |
| Deprecated `request` library | MEDIUM | ✅ Removed |
| Unused dependencies | LOW | ✅ Cleaned |

---

Generated: 2026-02-02
Updated: 2026-02-02 (Post-Fix)
