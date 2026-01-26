# 🧪 DynoPay API Comprehensive Testing Plan

**Test User**: Johnny LTD (user_id: 28)  
**Email**: john@dyno.pt  
**Date**: 2026-01-26

---

## 📋 Test Categories

### ✅ **Phase 1: User Profile & Authentication** (8 endpoints)
- [x] GET /api/user/profile - ✅ WORKING
- [ ] PUT /api/user/profile
- [ ] PUT /api/user/email
- [ ] DELETE /api/user/email
- [ ] PUT /api/user/phone
- [ ] DELETE /api/user/phone
- [ ] PUT /api/user/changePassword
- [ ] DELETE /api/user/account

### **Phase 2: Company Management** (7 endpoints)
- [ ] GET /api/company/getCompany
- [ ] POST /api/company/addCompany
- [ ] GET /api/company/getCompany/{id}
- [ ] PUT /api/company/updateCompany/{id}
- [ ] DELETE /api/company/deleteCompany/{id}
- [ ] POST /api/company/validateTaxId
- [ ] GET /api/company/getTransactions/{id}

### **Phase 3: Wallet Management** (8 endpoints)
- [ ] GET /api/wallet/getWallet
- [ ] POST /api/wallet/validateWalletAddress
- [ ] POST /api/wallet/verifyOtp
- [ ] POST /api/wallet/wallet/update/send-otp
- [ ] POST /api/wallet/wallet/update
- [ ] POST /api/wallet/wallet/delete/send-otp
- [ ] POST /api/wallet/wallet/delete/verify
- [ ] GET /api/wallet/configured-currencies

### **Phase 4: API Key Management** (13 endpoints)
- [ ] GET /api/userApi/getApi
- [ ] POST /api/userApi/addApi
- [ ] GET /api/userApi/getApi/{id}
- [ ] PUT /api/userApi/updateApi/{id}
- [ ] DELETE /api/userApi/deleteApi/{id}
- [ ] POST /api/userApi/regenerateKey/{id}
- [ ] POST /api/userApi/revoke/{id}
- [ ] PUT /api/userApi/toggleStatus/{id}
- [ ] PUT /api/userApi/rateLimit/{id}
- [ ] GET /api/userApi/usage/{id}
- [ ] GET /api/userApi/logs/{id}
- [ ] POST /api/userApi/getApiCustomers
- [ ] POST /api/userApi/createPlan

### **Phase 5: Payment Links** (5 endpoints)
- [ ] GET /api/pay/getPaymentLinks
- [ ] POST /api/pay/createPaymentLink
- [ ] GET /api/pay/links/{id}
- [ ] PUT /api/pay/links/{id}
- [ ] DELETE /api/pay/deletePaymentLink/{id}

### **Phase 6: Transactions** (3 endpoints)
- [ ] POST /api/wallet/getAllTransactions
- [ ] GET /api/wallet/transaction/{id}
- [ ] POST /api/wallet/transactions/export

### **Phase 7: Dashboard & Analytics** (4 endpoints)
- [ ] GET /api/dashboard
- [ ] GET /api/dashboard/chart
- [ ] GET /api/dashboard/fee-tiers
- [ ] GET /api/dashboard/recent-transactions

### **Phase 8: Notifications** (9 endpoints)
- [ ] GET /api/notifications
- [ ] GET /api/notifications/unread-count
- [ ] GET /api/notifications/types
- [ ] GET /api/notifications/preferences
- [ ] PUT /api/notifications/preferences
- [ ] PUT /api/notifications/{id}/read
- [ ] PUT /api/notifications/read-all
- [ ] DELETE /api/notifications/{id}
- [ ] POST /api/notifications/trigger-weekly-summary

### **Phase 9: Tax & Compliance** (4 endpoints)
- [ ] GET /api/tax/acronyms
- [ ] GET /api/tax/rate/{countryCode}
- [ ] GET /api/tax/lookup
- [ ] POST /api/tax/validate

### **Phase 10: Invoices** (3 endpoints)
- [ ] GET /api/invoices
- [ ] GET /api/invoices/{id}
- [ ] GET /api/invoices/{id}/pdf

### **Phase 11: Referral System** (5 endpoints)
- [ ] GET /api/referral/my-code
- [ ] GET /api/referral/list
- [ ] GET /api/referral/earnings
- [ ] GET /api/referral/leaderboard
- [ ] POST /api/referral/validate

### **Phase 12: Subscriptions** (5 endpoints)
- [ ] GET /api/subscriptions
- [ ] POST /api/subscriptions
- [ ] GET /api/subscriptions/{id}
- [ ] PUT /api/subscriptions/{id}
- [ ] DELETE /api/subscriptions/{id}

### **Phase 13: System Status & Health** (10 endpoints)
- [ ] GET /api/status
- [ ] GET /api/status/health
- [ ] POST /api/status/check
- [ ] GET /api/status/uptime
- [ ] GET /api/status/services
- [ ] GET /api/status/services/uptime
- [ ] GET /api/status/incidents
- [ ] GET /api/status/incidents/{id}
- [ ] GET /api/status/service/{serviceId}
- [ ] GET /api/status/service/{serviceId}/uptime

### **Phase 14: KYC** (2 endpoints)
- [ ] GET /api/kyc/status
- [ ] POST /api/kyc/submit

### **Phase 15: Payment Processing** (8 endpoints)
- [ ] POST /api/pay/calculate-payment
- [ ] POST /api/pay/getCurrencyRates
- [ ] GET /api/pay/network-fees
- [ ] POST /api/pay/addPayment
- [ ] POST /api/pay/authStep
- [ ] POST /api/pay/confirmPayment
- [ ] POST /api/pay/createCryptoPayment
- [ ] POST /api/pay/verifyCryptoPayment

---

## 📊 Total Endpoints to Test: ~95 endpoints

---

## 🎯 Testing Strategy

1. **Sequential Testing**: Test one category at a time
2. **Dependency Handling**: Some endpoints require data from previous tests (e.g., need company_id before creating API keys)
3. **Interactive**: Ask user for required data (wallet addresses, OTPs, etc.)
4. **Documentation**: Record results for each endpoint

---

## 🚀 Ready to Start Testing!

**Current Status**: Token validated ✅  
**User Profile**: Retrieved ✅  
**Next**: Waiting for your confirmation to start testing
