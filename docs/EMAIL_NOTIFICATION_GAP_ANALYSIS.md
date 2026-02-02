# DynoPay Email Notification Analysis Report
**Generated:** February 1, 2026  
**Type:** Gap Analysis & Recommendations

---

## 📊 CURRENT EMAIL COVERAGE

### ✅ Emails That ARE Being Sent (21 Templates, All Active)

| # | Email Template | Trigger Point | Status |
|---|----------------|---------------|--------|
| 1 | Welcome Email | User registration | ✅ ACTIVE |
| 2 | Company Profile Created | Company created | ✅ ACTIVE |
| 2b | Company Contact Welcome | Company created (to contact) | ✅ ACTIVE |
| 2c | Company Profile Updated | Profile updated | ✅ ACTIVE |
| 3 | Wallet OTP | Adding wallet | ✅ ACTIVE |
| 4 | Wallet Verified | Wallet confirmed | ✅ ACTIVE |
| 5 | Wallet Update OTP | Changing wallet | ✅ ACTIVE |
| 6 | Payment Received | Payment forwarded to merchant | ✅ ACTIVE |
| 7 | Add Wallet Reminder | No wallet after 24h (cron) | ✅ ACTIVE |
| 8 | Email Verification OTP | Email verification | ✅ ACTIVE |
| 9 | Login OTP | Login code requested | ✅ ACTIVE |
| 10 | Forgot Password OTP | Password reset requested | ✅ ACTIVE |
| 11 | Password Changed | Password updated | ✅ ACTIVE |
| 12 | Payment Link Created | New payment link | ✅ ACTIVE |
| 13 | KYC Required | $5K volume threshold | ✅ ACTIVE |
| 14 | KYC Approved | Verification passed | ✅ ACTIVE |
| 15 | KYC Rejected | Verification failed | ✅ ACTIVE |
| 16 | Weekly Summary | Every Monday (cron) | ✅ ACTIVE |
| 17 | Security Alert | Manual trigger only | ⚠️ PARTIAL |
| 18 | Invoice Generated | Invoice created | ✅ ACTIVE |
| 19 | Customer Payment Confirmation | Payment complete (to customer) | ✅ ACTIVE |
| 20 | KYC Started | KYC session created | ✅ ACTIVE |
| 21 | KYC Resubmission Required | Documents needed | ✅ ACTIVE |

---

## 🚨 CRITICAL MISSING EMAILS

### 1. **Payment Expiry Notification to Customer** ❌ MISSING
**Scenario:** Customer received payment link but payment link is about to expire
**Impact:** HIGH - Lost revenue, poor customer experience
**Recommendation:** Send reminder 24h before expiry

### 2. **Payment Failed/Underpaid Notification** ❌ MISSING  
**Scenario:** Customer sent wrong amount or payment timed out
**Impact:** HIGH - Customer confusion, support burden
**Recommendation:** Notify both merchant and customer

### 3. **New Device Login Alert** ❌ MISSING
**Scenario:** User logs in from new IP/device
**Impact:** HIGH - Security risk
**Recommendation:** Send security alert with device info

### 4. **API Key Created/Regenerated** ❌ MISSING
**Scenario:** User creates or regenerates API key
**Impact:** MEDIUM - Security awareness
**Recommendation:** Notify with partial key shown

### 5. **Wallet Deleted Confirmation** ❌ MISSING
**Scenario:** User deletes a wallet
**Impact:** MEDIUM - Security confirmation
**Recommendation:** Confirm deletion with wallet details

### 6. **Subscription Status Changed** ❌ MISSING
**Scenario:** Recurring payment subscription created, cancelled, or failed
**Impact:** HIGH - Revenue critical
**Recommendation:** Full subscription lifecycle emails

### 7. **Large Transaction Alert** ❌ MISSING
**Scenario:** Payment above certain threshold (e.g., $1000+)
**Impact:** MEDIUM - Fraud prevention
**Recommendation:** Alert merchant for manual verification

### 8. **Account Login Failed (Multiple Attempts)** ❌ MISSING
**Scenario:** 3+ failed login attempts
**Impact:** HIGH - Security
**Recommendation:** Alert user of potential breach attempt

---

## ⚠️ PARTIALLY IMPLEMENTED

### Security Alert Email (Template 17)
- **Current State:** Template exists but only manual trigger
- **Missing:** Automatic triggers for:
  - Login from new IP/location
  - Password change
  - Wallet changes
  - Multiple failed logins

### Weekly Summary (Template 16)
- **Current State:** Code exists but commented out in cronJobs.ts line 99
- **Issue:** `// await sendWeeklySummaryEmail(...)` is commented
- **Action Needed:** Uncomment and verify cron schedule

---

## 📋 DETAILED RECOMMENDATIONS

### Priority 1: Critical Security Emails

```typescript
// Missing: New Device Login Alert
const sendNewDeviceLoginEmail = async (
  email: string,
  name: string,
  ipAddress: string,
  deviceInfo: string,
  location: string,
  date: string,
  time: string
) => { ... }

// Missing: Failed Login Attempts Alert
const sendFailedLoginAttemptsEmail = async (
  email: string,
  name: string,
  attemptCount: number,
  ipAddress: string,
  date: string,
  time: string
) => { ... }
```

### Priority 2: Payment Lifecycle Emails

```typescript
// Missing: Payment Link Expiring Soon (to customer)
const sendPaymentExpiringEmail = async (
  customerEmail: string,
  companyName: string,
  amount: string,
  currency: string,
  paymentLink: string,
  expiresIn: string
) => { ... }

// Missing: Payment Failed/Underpaid
const sendPaymentFailedEmail = async (
  customerEmail: string,
  merchantEmail: string,
  reason: 'expired' | 'underpaid' | 'cancelled',
  amount: string,
  paidAmount: string | null,
  currency: string
) => { ... }
```

### Priority 3: Account Management Emails

```typescript
// Missing: API Key Created
const sendApiKeyCreatedEmail = async (
  email: string,
  name: string,
  keyType: 'development' | 'production',
  keyPreview: string, // First 8 chars only
  date: string,
  time: string
) => { ... }

// Missing: Wallet Deleted
const sendWalletDeletedEmail = async (
  email: string,
  name: string,
  walletAddressMasked: string,
  network: string,
  date: string,
  time: string
) => { ... }
```

### Priority 4: Subscription Emails

```typescript
// Missing: Subscription Created
const sendSubscriptionCreatedEmail = async (
  customerEmail: string,
  planName: string,
  amount: string,
  interval: string,
  nextBillingDate: string
) => { ... }

// Missing: Subscription Cancelled
const sendSubscriptionCancelledEmail = async (
  customerEmail: string,
  planName: string,
  effectiveDate: string
) => { ... }

// Missing: Subscription Payment Failed
const sendSubscriptionPaymentFailedEmail = async (
  customerEmail: string,
  merchantEmail: string,
  planName: string,
  amount: string,
  retryDate: string | null
) => { ... }
```

---

## 🔧 QUICK FIXES NEEDED

### 1. Uncomment Weekly Summary Cron Job
**File:** `/app/backend/utils/cronJobs.ts`
**Line:** 99
```typescript
// CHANGE FROM:
// await sendWeeklySummaryEmail(user.email, user.name, notificationData);

// CHANGE TO:
await sendWeeklySummaryEmail(user.email, user.name, notificationData);
```

### 2. Add Automatic Security Alerts
**File:** `/app/backend/controller/userController.ts`
**Action:** After successful login, check if IP is new and send security alert

### 3. Add Email to API Key Operations
**File:** `/app/backend/controller/apiController.ts`
**Action:** Send notification after `regenerateApiKey` function

---

## 📈 IMPLEMENTATION PRIORITY

| Priority | Email | Business Impact | Effort |
|----------|-------|-----------------|--------|
| 🔴 P0 | Payment Expiring to Customer | Revenue | Medium |
| 🔴 P0 | New Device Login Alert | Security | Low |
| 🔴 P0 | Failed Login Attempts | Security | Low |
| 🟡 P1 | Payment Failed/Underpaid | Support | Medium |
| 🟡 P1 | Subscription Lifecycle | Revenue | High |
| 🟢 P2 | API Key Notifications | Security | Low |
| 🟢 P2 | Wallet Deleted | Security | Low |
| 🟢 P2 | Large Transaction Alert | Fraud | Medium |

---

## ✅ SUMMARY

**Current Coverage:** 21 email templates covering ~70% of critical user actions

**Missing Critical Emails:**
1. Payment expiry reminders to customers
2. Security alerts (new device, failed logins)
3. Payment failure notifications
4. Subscription lifecycle emails
5. API key change notifications
6. Wallet deletion confirmations

**Quick Wins:**
- Uncomment weekly summary cron
- Add automatic security alert triggers
- Add payment expiry reminder cron job

**Estimated Implementation:** 2-3 days for all P0/P1 items

---

*Report generated by DynoPay Analysis Agent*
